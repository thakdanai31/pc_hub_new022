import { prisma } from '../../../config/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { NotFoundError, ConflictError, AppError } from '../../../common/errors.js';
import { buildPaginationMeta } from '../../../common/pagination.js';
import { hashPassword } from '../../../utils/password.js';
import { logAction } from '../../audit/audit.service.js';
import type {
  UserListQuery,
  CreatePrivilegedUserBody,
  UpdateUserBody,
  DisableUserBody,
} from './user-admin.schema.js';
import type { UserRole } from '../../../generated/prisma/client.js';

const selectFields = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isActive: true,
  bannedUntil: true,
  banReason: true,
  bannedAt: true,
  bannedByUserId: true,
  createdAt: true,
} as const;

const clearedBanData = {
  bannedUntil: null,
  banReason: null,
  bannedAt: null,
  bannedByUserId: null,
} as const;

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {};

  if (query.role) {
    where.role = query.role as UserRole;
  }

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search } },
      { lastName: { contains: query.search } },
      { email: { contains: query.search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: selectFields,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function createPrivilegedUser(body: CreatePrivilegedUserBody, role: 'STAFF' | 'ADMIN', actorUserId: number) {
  const passwordHash = await hashPassword(body.password);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: body.email },
        { phoneNumber: body.phoneNumber },
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

    throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phoneNumber: body.phoneNumber,
          passwordHash,
          role: role as UserRole,
        },
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: user.id,
        metadata: { role, email: body.email },
      });

      return user;
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

      throw new ConflictError('A user with this email or phone number already exists');
    }
    throw error;
  }
}

export async function updateUser(userId: number, body: UpdateUserBody, actorUserId: number) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existing || !(['STAFF', 'ADMIN'] as string[]).includes(existing.role)) {
    throw new NotFoundError('User not found');
  }

  if (body.phoneNumber !== undefined) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phoneNumber: body.phoneNumber,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existingPhone) {
      throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: body,
        select: selectFields,
      });

      await logAction(tx, {
        actorUserId,
        action: 'USER_UPDATE',
        entityType: 'User',
        entityId: userId,
      });

      return user;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
    }

    throw error;
  }
}

export async function disableUser(
  userId: number,
  adminUserId: number,
  body: DisableUserBody = {},
) {
  return setUserActiveStatus(userId, false, adminUserId, body);
}

export async function enableUser(userId: number, adminUserId: number) {
  return setUserActiveStatus(userId, true, adminUserId);
}

async function setUserActiveStatus(
  userId: number,
  isActive: boolean,
  adminUserId: number,
  body: DisableUserBody = {},
) {
  if (userId === adminUserId) {
    throw new AppError(
      `Cannot ${isActive ? 'enable' : 'disable'} your own account`,
      400,
      isActive ? 'SELF_ENABLE' : 'SELF_DISABLE',
    );
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      bannedUntil: true,
      banReason: true,
      bannedAt: true,
      bannedByUserId: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('User not found');
  }

  if (!isActive && body.bannedUntil && body.bannedUntil <= new Date()) {
    throw new AppError(
      'Temporary ban expiry must be in the future',
      400,
      'INVALID_BAN_EXPIRY',
    );
  }

  if (!isActive && existing.role === 'ADMIN' && existing.isActive) {
    const activeAdminCount = await prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
    });

    if (activeAdminCount <= 1) {
      throw new AppError(
        'Cannot disable the last active admin account',
        400,
        'LAST_ACTIVE_ADMIN',
      );
    }
  }

  return await prisma.$transaction(async (tx) => {
    const now = new Date();
    const data = isActive
      ? {
          isActive: true,
          ...clearedBanData,
        }
      : {
          isActive: false,
          bannedUntil: body.bannedUntil ?? null,
          banReason: body.banReason ?? null,
          bannedAt: now,
          bannedByUserId: adminUserId,
        };

    const user = await tx.user.update({
      where: { id: userId },
      data,
      select: selectFields,
    });

    await logAction(tx, {
      actorUserId: adminUserId,
      action: isActive ? 'USER_ENABLE' : 'USER_DISABLE',
      entityType: 'User',
      entityId: userId,
      metadata: isActive
        ? {
            isActive: true,
            clearedBanMetadata: true,
          }
        : {
            isActive: false,
            banReason: user.banReason,
            bannedAt: user.bannedAt?.toISOString() ?? null,
            bannedUntil: user.bannedUntil?.toISOString() ?? null,
            bannedByUserId: user.bannedByUserId,
          },
    });

    return user;
  });
}
