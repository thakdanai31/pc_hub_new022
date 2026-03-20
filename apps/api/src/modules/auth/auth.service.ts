import { prisma } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { normalizePhoneNumber } from '../../utils/phone.js';
import { logAction } from '../audit/audit.service.js';
import {
  signAccessToken,
  generateRefreshToken,
  generateOneTimeToken,
  hashToken,
} from '../../utils/token.js';
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from './password-reset-mail.service.js';
import type {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from './auth.schema.js';

const PASSWORD_RESET_EXPIRES_MS = 30 * 60 * 1000;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserSummary {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface PasswordResetRequestData {
  resetLink: string;
  expiresAt: string;
}

function toUserSummary(user: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}): UserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
  };
}

function buildPasswordResetLink(rawToken: string): string {
  const baseUrl = (env.APP_WEB_URL ?? env.CORS_ORIGIN).replace(/\/+$/, '');
  return `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function restoreExpiredTemporaryBanIfNeeded(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  if (!user.isActive && user.bannedUntil && user.bannedUntil <= new Date()) {
    const expiredBannedUntil = user.bannedUntil;

    return prisma.$transaction(async (tx) => {
      const restoredUser = await tx.user.update({
        where: { id: userId },
        data: {
          isActive: true,
          bannedUntil: null,
          banReason: null,
          bannedAt: null,
          bannedByUserId: null,
        },
      });

      await logAction(tx, {
        actorUserId: userId,
        action: 'USER_AUTO_ENABLE',
        entityType: 'User',
        entityId: userId,
        metadata: {
          expiredBannedUntil: expiredBannedUntil.toISOString(),
        },
      });

      return restoredUser;
    });
  }

  return user;
}

async function createRefreshTokenRecord(
  userId: number,
  rawToken: string,
): Promise<number> {
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );

  const record = await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return record.id;
}

export async function register(
  body: RegisterBody,
): Promise<{ user: UserSummary; tokens: AuthTokens }> {
  const phoneNumber = normalizePhoneNumber(body.phoneNumber);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: body.email },
        { phoneNumber },
      ],
    },
    select: {
      email: true,
      phoneNumber: true,
    },
  });
  if (existing) {
    if (existing.email === body.email) {
      throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
    }

    if (existing.phoneNumber === phoneNumber) {
      throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
    }
  }

  const passwordHash = await hashPassword(body.password);

  const user = await (async () => {
    try {
      return await prisma.user.create({
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phoneNumber,
          passwordHash,
          role: 'CUSTOMER',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const targetMeta = error.meta?.['target'];
        const target = Array.isArray(targetMeta)
          ? targetMeta.join(',')
          : String(targetMeta ?? '');

        if (target.includes('email')) {
          throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
        }

        if (target.includes('phoneNumber')) {
          throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
        }
      }

      throw error;
    }
  })();

  const refreshToken = generateRefreshToken();
  await createRefreshTokenRecord(user.id, refreshToken);

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    user: toUserSummary(user),
    tokens: { accessToken, refreshToken },
  };
}

export async function login(
  body: LoginBody,
): Promise<{ user: UserSummary; tokens: AuthTokens }> {
  let user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive && user.bannedUntil) {
    user = await restoreExpiredTemporaryBanIfNeeded(user.id) ?? user;
  }

  if (!user.isActive) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const refreshToken = generateRefreshToken();
  await createRefreshTokenRecord(user.id, refreshToken);

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return {
    user: toUserSummary(user),
    tokens: { accessToken, refreshToken },
  };
}

export async function refresh(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(rawToken);

  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Reuse detection: token was already revoked
  if (existing.revokedAt) {
    // Revoke all active tokens for this user (family invalidation)
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token reuse detected', 401, 'TOKEN_REUSE');
  }

  if (existing.expiresAt < new Date()) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED');
  }

  const currentUser = !existing.user.isActive && existing.user.bannedUntil
    ? await restoreExpiredTemporaryBanIfNeeded(existing.user.id) ?? existing.user
    : existing.user;

  if (!currentUser.isActive) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Account is disabled', 401, 'ACCOUNT_DISABLED');
  }

  // Rotate: revoke old, create new
  const newRawToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(
    Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );

  const newRecord = await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
    },
  });

  // Old record points forward to new record
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenId: newRecord.id },
  });

  const accessToken = signAccessToken({
    userId: currentUser.id,
    role: currentUser.role,
    email: currentUser.email,
  });

  return { accessToken, refreshToken: newRawToken };
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
  });

  if (existing && !existing.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }
}

export async function me(userId: number): Promise<UserSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return toUserSummary(user);
}

export async function requestPasswordReset(
  body: ForgotPasswordBody,
): Promise<PasswordResetRequestData | null> {
  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  });

  if (!user) {
    return null;
  }

  const rawToken = generateOneTimeToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const resetLink = buildPasswordResetLink(rawToken);

  if (isPasswordResetEmailConfigured()) {
    try {
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetLink,
        expiresMinutes: PASSWORD_RESET_EXPIRES_MS / (60 * 1000),
      });
    } catch (error) {
      console.warn('Password reset email send failed:', error);
    }
  }

  if (env.NODE_ENV === 'production') {
    return null;
  }

  return {
    resetLink,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function resetPassword(body: ResetPasswordBody): Promise<void> {
  const tokenHash = hashToken(body.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken) {
    throw new AppError('Invalid password reset token', 400, 'INVALID_RESET_TOKEN');
  }

  if (resetToken.usedAt) {
    throw new AppError('Password reset token has already been used', 400, 'RESET_TOKEN_USED');
  }

  if (resetToken.expiresAt < new Date()) {
    throw new AppError('Password reset token has expired', 400, 'RESET_TOKEN_EXPIRED');
  }

  const passwordHash = await hashPassword(body.password);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: { not: resetToken.id },
      },
      data: { usedAt: now },
    });
  });
}
