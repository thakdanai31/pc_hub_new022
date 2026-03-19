import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../utils/token.js';
import type { RegisterBody, LoginBody } from './auth.schema.js';

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
  const existing = await prisma.user.findUnique({
    where: { email: body.email },
  });
  if (existing) {
    throw new AppError('Email already registered', 409, 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phoneNumber: body.phoneNumber,
      passwordHash,
      role: 'CUSTOMER',
    },
  });

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
  const user = await prisma.user.findUnique({
    where: { email: body.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
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

  if (!existing.user.isActive) {
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
    userId: existing.user.id,
    role: existing.user.role,
    email: existing.user.email,
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
