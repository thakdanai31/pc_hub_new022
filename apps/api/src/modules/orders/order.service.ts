import { prisma } from '../../config/database.js';
import { AppError, NotFoundError } from '../../common/errors.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import { env } from '../../config/env.js';
import { ensureCloudinaryConfigured, uploadImage } from '../../config/cloudinary.js';
import { logAction } from '../audit/audit.service.js';
import type { OrderListQuery } from './order.schema.js';
import type { OrderStatus, PaymentMethod } from '../../generated/prisma/client.js';

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'REJECTED', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_REVIEW', 'CANCELLED'],
  PAYMENT_SUBMITTED: [],
  PAYMENT_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  REJECTED: [],
  DELIVERED: [],
  CANCELLED: [],
};

export async function listMyOrders(userId: number, query: OrderListQuery) {
  const where: { userId: number; status?: OrderStatus } = { userId };
  if (query.status) {
    where.status = query.status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalAmount: Number(o.totalAmount),
      itemCount: o._count.items,
      createdAt: o.createdAt,
    })),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getMyOrder(orderId: number, userId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      addressSnapshot: true,
      subtotalAmount: true,
      shippingAmount: true,
      totalAmount: true,
      customerNote: true,
      approvedAt: true,
      rejectedAt: true,
      rejectReason: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productId: true,
          productSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      payment: {
        select: {
          id: true,
          paymentMethod: true,
          status: true,
          amount: true,
          rejectReason: true,
          reviewedAt: true,
          slips: {
            select: {
              id: true,
              imageUrl: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    addressSnapshot: order.addressSnapshot,
    subtotalAmount: Number(order.subtotalAmount),
    shippingAmount: Number(order.shippingAmount),
    totalAmount: Number(order.totalAmount),
    customerNote: order.customerNote,
    approvedAt: order.approvedAt,
    rejectedAt: order.rejectedAt,
    rejectReason: order.rejectReason,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSnapshot: item.productSnapshot,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    payment: order.payment
      ? {
          id: order.payment.id,
          paymentMethod: order.payment.paymentMethod,
          status: order.payment.status,
          amount: Number(order.payment.amount),
          rejectReason: order.payment.rejectReason,
          reviewedAt: order.payment.reviewedAt,
          slips: order.payment.slips,
        }
      : null,
  };
}

export async function getMyPayment(orderId: number, userId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      payment: {
        select: {
          id: true,
          paymentMethod: true,
          status: true,
          amount: true,
          rejectReason: true,
          reviewedAt: true,
          slips: {
            select: { id: true, imageUrl: true, uploadedAt: true },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  if (!order.payment) {
    throw new NotFoundError('Payment not found');
  }

  return {
    id: order.payment.id,
    paymentMethod: order.payment.paymentMethod,
    status: order.payment.status,
    amount: Number(order.payment.amount),
    rejectReason: order.payment.rejectReason,
    reviewedAt: order.payment.reviewedAt,
    slips: order.payment.slips,
  };
}

export async function getPromptPayQR(orderId: number, userId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      totalAmount: true,
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  if (order.paymentMethod !== 'PROMPTPAY_QR') {
    throw new AppError('This order does not use PromptPay payment', 400, 'INVALID_PAYMENT_METHOD');
  }

  if (order.status !== 'AWAITING_PAYMENT') {
    throw new AppError('QR code is only available for orders awaiting payment', 400, 'INVALID_ORDER_STATUS');
  }

  const promptPayId = env.PROMPTPAY_ID;
  if (!promptPayId) {
    throw new AppError('PromptPay is not configured', 503, 'SERVICE_UNAVAILABLE');
  }

  const amount = Number(order.totalAmount);
  const qrImageUrl = `https://promptpay.io/${promptPayId}/${amount}.png`;

  return {
    qrDataUrl: qrImageUrl,
    amount,
    promptPayId,
    orderNumber: order.orderNumber,
  };
}

export async function uploadPaymentSlip(
  orderId: number,
  userId: number,
  file: UploadedFile,
) {
  ensureCloudinaryConfigured();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentMethod: true,
      payment: { select: { id: true, status: true } },
    },
  });

  if (!order || order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  if (order.paymentMethod !== 'PROMPTPAY_QR') {
    throw new AppError('Slip upload is only for PromptPay orders', 400, 'INVALID_PAYMENT_METHOD');
  }

  if (order.status !== 'AWAITING_PAYMENT') {
    throw new AppError(
      'Payment slip can only be uploaded for orders awaiting payment',
      400,
      'INVALID_ORDER_STATUS',
    );
  }

  if (!order.payment) {
    throw new AppError('Payment record not found', 500, 'INTERNAL_ERROR');
  }

  const paymentId = order.payment.id;
  const { imageUrl, imagePublicId } = await uploadImage(file.buffer, 'payment-slips');

  await prisma.$transaction(async (tx) => {
    await tx.paymentSlip.create({
      data: {
        paymentId,
        uploadedByUserId: userId,
        imageUrl,
        imagePublicId,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { status: 'PAYMENT_REVIEW' },
    });

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'PENDING_REVIEW' },
    });
  });

  return { imageUrl, uploadedAt: new Date() };
}

// --- Backoffice functions ---

export async function listOrdersForReview(query: {
  page: number;
  limit: number;
  status?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Record<string, unknown> = {};

  if (query.status) {
    where['status'] = query.status as OrderStatus;
  }

  if (query.paymentMethod) {
    where['paymentMethod'] = query.paymentMethod as PaymentMethod;
  }

  if (query.search) {
    where['user'] = {
      OR: [
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
      ],
    };
  }

  if (query.dateFrom || query.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (query.dateFrom) createdAt['gte'] = new Date(query.dateFrom);
    if (query.dateTo) {
      const to = new Date(query.dateTo);
      to.setDate(to.getDate() + 1);
      createdAt['lt'] = to;
    }
    where['createdAt'] = createdAt;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        createdAt: true,
        _count: { select: { items: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        payment: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalAmount: Number(o.totalAmount),
      itemCount: o._count.items,
      createdAt: o.createdAt,
      customer: o.user,
      paymentStatus: o.payment?.status ?? null,
    })),
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getOrderForReview(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      addressSnapshot: true,
      subtotalAmount: true,
      shippingAmount: true,
      totalAmount: true,
      customerNote: true,
      approvedByUserId: true,
      approvedAt: true,
      rejectedByUserId: true,
      rejectedAt: true,
      rejectReason: true,
      createdAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true },
      },
      items: {
        select: {
          id: true,
          productId: true,
          productSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      payment: {
        select: {
          id: true,
          paymentMethod: true,
          status: true,
          amount: true,
          rejectReason: true,
          reviewedAt: true,
          reviewedByUserId: true,
          slips: {
            select: { id: true, imageUrl: true, uploadedAt: true },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    addressSnapshot: order.addressSnapshot,
    subtotalAmount: Number(order.subtotalAmount),
    shippingAmount: Number(order.shippingAmount),
    totalAmount: Number(order.totalAmount),
    customerNote: order.customerNote,
    approvedByUserId: order.approvedByUserId,
    approvedAt: order.approvedAt,
    rejectedByUserId: order.rejectedByUserId,
    rejectedAt: order.rejectedAt,
    rejectReason: order.rejectReason,
    createdAt: order.createdAt,
    customer: order.user,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSnapshot: item.productSnapshot,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
    payment: order.payment
      ? {
          id: order.payment.id,
          paymentMethod: order.payment.paymentMethod,
          status: order.payment.status,
          amount: Number(order.payment.amount),
          rejectReason: order.payment.rejectReason,
          reviewedAt: order.payment.reviewedAt,
          reviewedByUserId: order.payment.reviewedByUserId,
          slips: order.payment.slips,
        }
      : null,
  };
}

async function restoreStock(orderId: number, tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true },
  });

  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

export async function approveOrder(orderId: number, staffUserId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentMethod: true, payment: { select: { id: true } } },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const now = new Date();

  // COD orders in PENDING -> move to PROCESSING
  if (order.paymentMethod === 'COD' && order.status === 'PENDING') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING',
          approvedByUserId: staffUserId,
          approvedAt: now,
        },
      });

      await logAction(tx, {
        actorUserId: staffUserId,
        action: 'ORDER_APPROVE',
        entityType: 'Order',
        entityId: orderId,
        metadata: { fromStatus: order.status, toStatus: 'PROCESSING', paymentMethod: 'COD' },
      });
    });
    return { status: 'PROCESSING' as const };
  }

  // PromptPay orders in PAYMENT_REVIEW -> APPROVED
  if (order.paymentMethod === 'PROMPTPAY_QR' && order.status === 'PAYMENT_REVIEW') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          approvedByUserId: staffUserId,
          approvedAt: now,
        },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'APPROVED',
            reviewedByUserId: staffUserId,
            reviewedAt: now,
          },
        });
      }

      await logAction(tx, {
        actorUserId: staffUserId,
        action: 'ORDER_APPROVE',
        entityType: 'Order',
        entityId: orderId,
        metadata: { fromStatus: order.status, toStatus: 'APPROVED', paymentMethod: 'PROMPTPAY_QR' },
      });
    });
    return { status: 'APPROVED' as const };
  }

  throw new AppError(
    'This order cannot be approved in its current state',
    400,
    'INVALID_ORDER_STATUS',
  );
}

export async function rejectOrder(orderId: number, staffUserId: number, reason: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentMethod: true, payment: { select: { id: true } } },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // COD in PENDING or PromptPay in PAYMENT_REVIEW can be rejected
  const canReject =
    (order.paymentMethod === 'COD' && order.status === 'PENDING') ||
    (order.paymentMethod === 'PROMPTPAY_QR' && order.status === 'PAYMENT_REVIEW');

  if (!canReject) {
    throw new AppError(
      'This order cannot be rejected in its current state',
      400,
      'INVALID_ORDER_STATUS',
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'REJECTED',
        rejectedByUserId: staffUserId,
        rejectedAt: now,
        rejectReason: reason,
      },
    });

    if (order.payment && order.paymentMethod === 'PROMPTPAY_QR') {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: staffUserId,
          reviewedAt: now,
          rejectReason: reason,
        },
      });
    }

    // Restore stock
    await restoreStock(orderId, tx);

    await logAction(tx, {
      actorUserId: staffUserId,
      action: 'ORDER_REJECT',
      entityType: 'Order',
      entityId: orderId,
      metadata: { fromStatus: order.status, reason },
    });
  });

  return { status: 'REJECTED' as const };
}

export async function advanceOrderStatus(orderId: number, newStatus: string, staffUserId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentMethod: true, payment: { select: { id: true, status: true } } },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const allowed = ALLOWED_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition from ${order.status} to ${newStatus}`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  // Only allow PROCESSING, SHIPPED, DELIVERED through this endpoint
  // APPROVED/REJECTED are handled by approve/reject endpoints
  const advanceable = ['PROCESSING', 'SHIPPED', 'DELIVERED'];
  if (!advanceable.includes(newStatus)) {
    throw new AppError(
      `Use the appropriate endpoint for ${newStatus} transitions`,
      400,
      'INVALID_STATUS_TRANSITION',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus as OrderStatus },
    });

    // COD orders: mark payment as PAID when delivered
    if (newStatus === 'DELIVERED' && order.paymentMethod === 'COD' && order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: 'APPROVED' },
      });
    }

    await logAction(tx, {
      actorUserId: staffUserId,
      action: 'ORDER_ADVANCE_STATUS',
      entityType: 'Order',
      entityId: orderId,
      metadata: { fromStatus: order.status, toStatus: newStatus },
    });
  });

  return { status: newStatus };
}
