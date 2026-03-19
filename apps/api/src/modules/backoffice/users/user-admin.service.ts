import { prisma } from '../../../config/database.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { NotFoundError, ConflictError, AppError } from '../../../common/errors.js';
import { buildPaginationMeta } from '../../../common/pagination.js';
import { hashPassword } from '../../../utils/password.js';
import { logAction } from '../../audit/audit.service.js';
import type { UserListQuery, CreatePrivilegedUserBody, UpdateUserBody } from './user-admin.schema.js';
import type { UserRole } from '../../../generated/prisma/client.js';

const selectFields = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {
    role: query.role
      ? (query.role as UserRole)
      : { in: ['STAFF', 'ADMIN'] as UserRole[] },
  };

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
      throw new ConflictError('A user with this email already exists');
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
}

export async function disableUser(userId: number, adminUserId: number) {
  if (userId === adminUserId) {
    throw new AppError('Cannot disable your own account', 400, 'SELF_DISABLE');
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!existing || !(['STAFF', 'ADMIN'] as string[]).includes(existing.role)) {
    throw new NotFoundError('User not found');
  }

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: selectFields,
    });

    await logAction(tx, {
      actorUserId: adminUserId,
      action: 'USER_DISABLE',
      entityType: 'User',
      entityId: userId,
    });

    return user;
  });
}
