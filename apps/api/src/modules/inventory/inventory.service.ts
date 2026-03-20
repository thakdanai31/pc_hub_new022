import { prisma } from "../../config/database.js";
import { AppError, NotFoundError } from "../../common/errors.js";
import { buildPaginationMeta } from "../../common/pagination.js";
import { logAction } from "../audit/audit.service.js";
import type {
  InventoryTransactionType,
  Prisma,
} from "../../generated/prisma/client.js";
import type {
  InventoryMutationBody,
  InventoryTransactionListQuery,
  ProductInventoryTransactionListQuery,
} from "./inventory.schema.js";

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export type InventoryTransactionClient = TransactionClient;

const INCREMENT_TYPES = new Set<InventoryTransactionType>([
  "RESTOCK",
  "ADJUSTMENT_IN",
  "RETURN_IN",
]);

const DECREMENT_TYPES = new Set<InventoryTransactionType>([
  "SALE",
  "ADJUSTMENT_OUT",
  "RETURN_OUT",
]);

const productSummarySelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  stock: true,
} satisfies Prisma.ProductSelect;

const transactionSelect = {
  id: true,
  productId: true,
  type: true,
  quantity: true,
  referenceId: true,
  note: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
    },
  },
} satisfies Prisma.InventoryTransactionSelect;

interface InventoryChangeInput {
  productId: number;
  type: InventoryTransactionType;
  quantity: number;
  referenceId?: number;
  note?: string;
}

interface OrderInventoryChangeInput {
  orderId: number;
  actorUserId: number;
  type: "SALE" | "RETURN_IN";
  action: string;
  note: string;
}

interface OrderInventoryHistoryBackfillInput {
  orderId: number;
  actorUserId: number;
  type: "SALE" | "RETURN_IN";
  action: string;
  note: string;
}

function ensurePositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(
      "Quantity must be a positive integer",
      400,
      "INVALID_QUANTITY",
    );
  }
}

function buildDefaultNote(type: InventoryTransactionType): string {
  switch (type) {
    case "RESTOCK":
      return "Manual restock via backoffice";
    case "ADJUSTMENT_IN":
      return "Manual inventory adjustment in";
    case "ADJUSTMENT_OUT":
      return "Manual inventory adjustment out";
    case "SALE":
      return "Inventory deduction from sale";
    case "RETURN_IN":
      return "Inventory returned in";
    case "RETURN_OUT":
      return "Inventory returned out";
  }
}

function normalizeNote(
  type: InventoryTransactionType,
  note: string | undefined,
): string {
  return note?.trim() || buildDefaultNote(type);
}

function buildListWhere(
  query: Pick<
    InventoryTransactionListQuery,
    "productId" | "type" | "referenceId"
  >,
): Prisma.InventoryTransactionWhereInput {
  return {
    ...(query.productId !== undefined && { productId: query.productId }),
    ...(query.type !== undefined && { type: query.type }),
    ...(query.referenceId !== undefined && { referenceId: query.referenceId }),
  };
}

async function ensureProductExists(productId: number): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }
}

async function applyInventoryChange(
  tx: TransactionClient,
  input: InventoryChangeInput,
) {
  ensurePositiveQuantity(input.quantity);

  const existingProduct = await tx.product.findUnique({
    where: { id: input.productId },
    select: productSummarySelect,
  });

  if (!existingProduct) {
    throw new NotFoundError("Product not found");
  }

  if (INCREMENT_TYPES.has(input.type)) {
    await tx.product.update({
      where: { id: input.productId },
      data: {
        stock: {
          increment: input.quantity,
        },
      },
    });
  } else if (DECREMENT_TYPES.has(input.type)) {
    const updated = await tx.product.updateMany({
      where: {
        id: input.productId,
        stock: { gte: input.quantity },
      },
      data: {
        stock: {
          decrement: input.quantity,
        },
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        `Insufficient stock. Available: ${String(existingProduct.stock)}`,
        400,
        "INSUFFICIENT_STOCK",
      );
    }
  }

  const transaction = await tx.inventoryTransaction.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      referenceId: input.referenceId,
      note: normalizeNote(input.type, input.note),
    },
    select: transactionSelect,
  });

  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: productSummarySelect,
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return {
    product,
    transaction,
    previousStock: existingProduct.stock,
  };
}

async function getOrderInventoryContext(
  tx: TransactionClient,
  orderId: number,
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.items.length === 0) {
    throw new AppError("Order has no items", 500, "INTERNAL_ERROR");
  }

  return order;
}

async function applyOrderInventoryChangeSet(
  tx: TransactionClient,
  input: OrderInventoryChangeInput,
) {
  const order = await getOrderInventoryContext(tx, input.orderId);

  const existingTypeCount = await tx.inventoryTransaction.count({
    where: {
      referenceId: input.orderId,
      type: input.type,
    },
  });

  if (existingTypeCount > 0) {
    throw new AppError(
      input.type === "SALE"
        ? "Inventory has already been committed for this order"
        : "Inventory has already been restored for this order",
      409,
      input.type === "SALE"
        ? "ORDER_INVENTORY_ALREADY_COMMITTED"
        : "ORDER_INVENTORY_ALREADY_RESTORED",
    );
  }

  if (input.type === "RETURN_IN") {
    const committedCount = await tx.inventoryTransaction.count({
      where: {
        referenceId: input.orderId,
        type: "SALE",
      },
    });

    if (committedCount === 0) {
      throw new AppError(
        "Order inventory has not been committed",
        400,
        "ORDER_INVENTORY_NOT_COMMITTED",
      );
    }
  }

  const transactionIds: number[] = [];

  for (const item of order.items) {
    const result = await applyInventoryChange(tx, {
      productId: item.productId,
      type: input.type,
      quantity: item.quantity,
      referenceId: input.orderId,
      note: `${input.note} (${order.orderNumber})`,
    });
    transactionIds.push(result.transaction.id);
  }

  await logAction(tx, {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "Order",
    entityId: input.orderId,
    metadata: {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentMethod: order.paymentMethod,
      inventoryTransactionType: input.type,
      inventoryTransactionCount: transactionIds.length,
    },
  });

  return {
    order,
    transactionIds,
  };
}

async function createOrderInventoryHistoryOnly(
  tx: TransactionClient,
  input: OrderInventoryHistoryBackfillInput,
) {
  const order = await getOrderInventoryContext(tx, input.orderId);

  const existingTypeCount = await tx.inventoryTransaction.count({
    where: {
      referenceId: input.orderId,
      type: input.type,
    },
  });

  if (existingTypeCount > 0) {
    throw new AppError(
      input.type === "SALE"
        ? "Inventory history already exists for this order sale"
        : "Inventory history already exists for this order return",
      409,
      input.type === "SALE"
        ? "ORDER_SALE_HISTORY_ALREADY_EXISTS"
        : "ORDER_RETURN_HISTORY_ALREADY_EXISTS",
    );
  }

  const transactionIds: number[] = [];

  for (const item of order.items) {
    const transaction = await tx.inventoryTransaction.create({
      data: {
        productId: item.productId,
        type: input.type,
        quantity: item.quantity,
        referenceId: input.orderId,
        note: normalizeNote(input.type, `${input.note} (${order.orderNumber})`),
      },
      select: { id: true },
    });
    transactionIds.push(transaction.id);
  }

  await logAction(tx, {
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "Order",
    entityId: input.orderId,
    metadata: {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentMethod: order.paymentMethod,
      inventoryTransactionType: input.type,
      inventoryTransactionCount: transactionIds.length,
      historyOnly: true,
      stockMutationApplied: false,
    },
  });

  return {
    order,
    transactionIds,
  };
}

async function applyManualInventoryChange(
  productId: number,
  type: InventoryTransactionType,
  body: InventoryMutationBody,
  actorUserId: number,
  action: string,
) {
  return prisma.$transaction(async (tx) => {
    const result = await applyInventoryChange(tx, {
      productId,
      type,
      quantity: body.quantity,
      referenceId: body.referenceId,
      note: body.note,
    });

    await logAction(tx, {
      actorUserId,
      action,
      entityType: "InventoryTransaction",
      entityId: result.transaction.id,
      metadata: {
        productId,
        type,
        quantity: body.quantity,
        referenceId: body.referenceId ?? null,
        note: result.transaction.note,
        previousStock: result.previousStock,
        resultingStock: result.product.stock,
      },
    });

    return result;
  });
}

export async function restockProduct(
  productId: number,
  body: InventoryMutationBody,
  actorUserId: number,
) {
  return applyManualInventoryChange(
    productId,
    "RESTOCK",
    body,
    actorUserId,
    "INVENTORY_RESTOCK",
  );
}

export async function adjustInventoryIn(
  productId: number,
  body: InventoryMutationBody,
  actorUserId: number,
) {
  return applyManualInventoryChange(
    productId,
    "ADJUSTMENT_IN",
    body,
    actorUserId,
    "INVENTORY_ADJUST_IN",
  );
}

export async function adjustInventoryOut(
  productId: number,
  body: InventoryMutationBody,
  actorUserId: number,
) {
  return applyManualInventoryChange(
    productId,
    "ADJUSTMENT_OUT",
    body,
    actorUserId,
    "INVENTORY_ADJUST_OUT",
  );
}

export async function commitOrderInventory(
  tx: TransactionClient,
  orderId: number,
  actorUserId: number,
) {
  return applyOrderInventoryChangeSet(tx, {
    orderId,
    actorUserId,
    type: "SALE",
    action: "INVENTORY_SALE_COMMIT",
    note: "Committed stock for order",
  });
}

export async function restoreOrderInventory(
  tx: TransactionClient,
  orderId: number,
  actorUserId: number,
) {
  return applyOrderInventoryChangeSet(tx, {
    orderId,
    actorUserId,
    type: "RETURN_IN",
    action: "INVENTORY_RETURN_IN_RESTORE",
    note: "Restored stock from cancelled order",
  });
}

export async function backfillOrderSaleHistory(
  tx: TransactionClient,
  orderId: number,
  actorUserId: number,
) {
  return createOrderInventoryHistoryOnly(tx, {
    orderId,
    actorUserId,
    type: "SALE",
    action: "INVENTORY_SALE_HISTORY_BACKFILL",
    note: "Reconciliation backfill: missing SALE history for order (no stock change applied)",
  });
}

export async function backfillOrderReturnHistory(
  tx: TransactionClient,
  orderId: number,
  actorUserId: number,
) {
  return createOrderInventoryHistoryOnly(tx, {
    orderId,
    actorUserId,
    type: "RETURN_IN",
    action: "INVENTORY_RETURN_HISTORY_BACKFILL",
    note: "Reconciliation backfill: missing RETURN_IN history for order (no stock change applied)",
  });
}

export async function getInventoryTransactions(
  query: InventoryTransactionListQuery,
) {
  const where = buildListWhere(query);

  const [rows, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      select: transactionSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return {
    data: rows,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getInventoryTransactionsByProduct(
  productId: number,
  query: ProductInventoryTransactionListQuery,
) {
  await ensureProductExists(productId);

  const where = buildListWhere({
    ...query,
    productId,
  });

  const [rows, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      select: transactionSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return {
    data: rows,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}
