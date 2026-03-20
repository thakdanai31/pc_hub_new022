import { prisma } from '../../config/database.js';
import { AppError, NotFoundError } from '../../common/errors.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import { logAction } from '../audit/audit.service.js';
import type { ClaimStatus, Prisma } from '../../generated/prisma/client.js';
import type {
  AdminClaimListQuery,
  CreateClaimBody,
  MyClaimListQuery,
  UpdateClaimAdminNoteBody,
  UpdateClaimStatusBody,
} from './claim.schema.js';

const myClaimSelect = {
  id: true,
  userId: true,
  orderId: true,
  productId: true,
  issueDescription: true,
  status: true,
  adminNote: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      createdAt: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
    },
  },
} satisfies Prisma.ClaimSelect;

const adminClaimSelect = {
  ...myClaimSelect,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
    },
  },
} satisfies Prisma.ClaimSelect;

const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'SENT_TO_MANUFACTURER',
];

const CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  PENDING: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['SENT_TO_MANUFACTURER', 'COMPLETED', 'REJECTED'],
  SENT_TO_MANUFACTURER: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

function buildAdminWhere(query: AdminClaimListQuery): Prisma.ClaimWhereInput {
  const where: Prisma.ClaimWhereInput = {
    ...(query.status !== undefined && { status: query.status }),
    ...(query.userId !== undefined && { userId: query.userId }),
    ...(query.orderId !== undefined && { orderId: query.orderId }),
    ...(query.productId !== undefined && { productId: query.productId }),
  };

  if (query.search) {
    where.OR = [
      { issueDescription: { contains: query.search } },
      { user: { is: { firstName: { contains: query.search } } } },
      { user: { is: { lastName: { contains: query.search } } } },
      { user: { is: { email: { contains: query.search } } } },
      { order: { is: { orderNumber: { contains: query.search } } } },
      { product: { is: { name: { contains: query.search } } } },
      { product: { is: { sku: { contains: query.search } } } },
    ];
  }

  return where;
}

function ensureValidClaimStatusTransition(
  currentStatus: ClaimStatus,
  nextStatus: ClaimStatus,
): void {
  if (currentStatus === nextStatus) {
    throw new AppError(
      'Claim status is already set to this value',
      400,
      'NO_OP_STATUS_UPDATE',
    );
  }

  const allowedNextStatuses = CLAIM_STATUS_TRANSITIONS[currentStatus];
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new AppError(
      `Cannot transition claim from ${currentStatus} to ${nextStatus}`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }
}

export async function createClaim(userId: number, body: CreateClaimBody) {
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  const order = await prisma.order.findFirst({
    where: {
      id: body.orderId,
      userId,
    },
    select: {
      id: true,
      status: true,
      items: {
        where: { productId: body.productId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Claims are restricted to delivered orders so staff/admin only review fulfilled purchases.
  if (order.status !== 'DELIVERED') {
    throw new AppError(
      'Claims can only be created for delivered orders',
      400,
      'INVALID_ORDER_STATUS',
    );
  }

  if (order.items.length === 0) {
    throw new AppError(
      'Selected product was not purchased in this order',
      400,
      'INVALID_ORDER_PRODUCT',
    );
  }

  return prisma.$transaction(async (tx) => {
    const existingActiveClaim = await tx.claim.findFirst({
      where: {
        userId,
        orderId: body.orderId,
        productId: body.productId,
        status: {
          in: ACTIVE_CLAIM_STATUSES,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existingActiveClaim) {
      throw new AppError(
        'An active claim already exists for this product in the selected order',
        409,
        'ACTIVE_CLAIM_EXISTS',
      );
    }

    const claim = await tx.claim.create({
      data: {
        userId,
        orderId: body.orderId,
        productId: body.productId,
        issueDescription: body.issueDescription,
      },
      select: myClaimSelect,
    });

    await logAction(tx, {
      actorUserId: userId,
      action: 'CLAIM_CREATE',
      entityType: 'Claim',
      entityId: claim.id,
      metadata: {
        orderId: body.orderId,
        productId: body.productId,
      },
    });

    return claim;
  });
}

export async function getMyClaims(userId: number, query: MyClaimListQuery) {
  const where: Prisma.ClaimWhereInput = {
    userId,
    ...(query.status !== undefined && { status: query.status }),
  };

  const [rows, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      select: myClaimSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.claim.count({ where }),
  ]);

  return {
    data: rows,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getMyClaimById(claimId: number, userId: number) {
  const claim = await prisma.claim.findFirst({
    where: {
      id: claimId,
      userId,
    },
    select: myClaimSelect,
  });

  if (!claim) {
    throw new NotFoundError('Claim not found');
  }

  return claim;
}

export async function getClaimsForAdmin(query: AdminClaimListQuery) {
  const where = buildAdminWhere(query);

  const [rows, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      select: adminClaimSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.claim.count({ where }),
  ]);

  return {
    data: rows,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getClaimForAdmin(claimId: number) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: adminClaimSelect,
  });

  if (!claim) {
    throw new NotFoundError('Claim not found');
  }

  return claim;
}

export async function updateClaimStatus(
  claimId: number,
  body: UpdateClaimStatusBody,
  actorUserId: number,
) {
  const existing = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Claim not found');
  }

  ensureValidClaimStatusTransition(existing.status, body.status);

  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.update({
      where: { id: claimId },
      data: {
        status: body.status,
      },
      select: adminClaimSelect,
    });

    await logAction(tx, {
      actorUserId,
      action: 'CLAIM_STATUS_UPDATE',
      entityType: 'Claim',
      entityId: claimId,
      metadata: {
        fromStatus: existing.status,
        toStatus: body.status,
      },
    });

    return claim;
  });
}

export async function updateClaimAdminNote(
  claimId: number,
  body: UpdateClaimAdminNoteBody,
  actorUserId: number,
) {
  const existing = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      adminNote: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Claim not found');
  }

  return prisma.$transaction(async (tx) => {
    const claim = await tx.claim.update({
      where: { id: claimId },
      data: {
        adminNote: body.adminNote,
      },
      select: adminClaimSelect,
    });

    await logAction(tx, {
      actorUserId,
      action: 'CLAIM_ADMIN_NOTE_UPDATE',
      entityType: 'Claim',
      entityId: claimId,
      metadata: {
        hadAdminNote: existing.adminNote !== null,
        hasAdminNote: body.adminNote !== null,
      },
    });

    return claim;
  });
}
