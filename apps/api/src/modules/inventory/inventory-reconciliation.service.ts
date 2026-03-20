import { prisma } from '../../config/database.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import { logActionBestEffort } from '../audit/audit.service.js';
import {
  backfillOrderReturnHistory,
  backfillOrderSaleHistory,
} from './inventory.service.js';
import type { InventoryTransactionClient } from './inventory.service.js';
import type {
  InventoryReconciliationBackfillBody,
  InventoryReconciliationIssueCodeValue,
  InventoryReconciliationReportQuery,
} from './inventory.schema.js';
import type { OrderStatus, Prisma } from '../../generated/prisma/client.js';

type ReconciliationClient = typeof prisma | InventoryTransactionClient;

type ReconciliationAction =
  | 'BACKFILL_SALE_HISTORY'
  | 'BACKFILL_RETURN_HISTORY';

type ReconciliationState =
  | 'COMMITTED'
  | 'COMMITTED_CANCELLED'
  | 'NOT_COMMITTED'
  | 'AMBIGUOUS_CANCELLED';

interface ReconciliationIssue {
  code: InventoryReconciliationIssueCodeValue;
  message: string;
  autoFixable: boolean;
}

interface QuantitySummary {
  totalQuantity: number;
  transactionCount: number;
  quantityByProductId: Map<number, number>;
}

interface OrderRow {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: 'COD' | 'PROMPTPAY_QR';
  approvedAt: Date | null;
  createdAt: Date;
  items: Array<{
    productId: number;
    quantity: number;
  }>;
}

interface AuditLogRow {
  action: string;
  metadata: Prisma.JsonValue | null;
}

const COMMITTED_STATUSES = new Set<OrderStatus>([
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
]);

function buildOrderWhere(
  query: InventoryReconciliationReportQuery,
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    ...(query.orderId !== undefined && { id: query.orderId }),
    ...(query.status !== undefined && { status: query.status }),
  };

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

  return where;
}

function isRecord(
  value: Prisma.JsonValue | null,
): value is Record<string, Prisma.JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMetadataString(
  metadata: Prisma.JsonValue | null,
  key: string,
): string | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === 'string' ? value : null;
}

function buildExpectedQuantitySummary(
  items: OrderRow['items'],
): QuantitySummary {
  let totalQuantity = 0;
  const quantityByProductId = new Map<number, number>();
  for (const item of items) {
    totalQuantity += item.quantity;
    quantityByProductId.set(
      item.productId,
      (quantityByProductId.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return {
    totalQuantity,
    transactionCount: items.length,
    quantityByProductId,
  };
}

function buildActualQuantitySummary(
  rows: Array<{ productId: number; quantity: number }>,
): QuantitySummary {
  let totalQuantity = 0;
  const quantityByProductId = new Map<number, number>();
  for (const row of rows) {
    totalQuantity += row.quantity;
    quantityByProductId.set(
      row.productId,
      (quantityByProductId.get(row.productId) ?? 0) + row.quantity,
    );
  }

  return {
    totalQuantity,
    transactionCount: rows.length,
    quantityByProductId,
  };
}

function hasProductQuantityMismatch(
  expected: QuantitySummary,
  actual: QuantitySummary,
): boolean {
  if (expected.quantityByProductId.size !== actual.quantityByProductId.size) {
    return true;
  }

  for (const [productId, expectedQuantity] of expected.quantityByProductId) {
    if (actual.quantityByProductId.get(productId) !== expectedQuantity) {
      return true;
    }
  }

  return false;
}

function deriveCommittedState(
  order: OrderRow,
  saleSummary: QuantitySummary,
  logs: AuditLogRow[],
): { state: ReconciliationState; commitEvidence: string[] } {
  const commitEvidence: string[] = [];

  if (COMMITTED_STATUSES.has(order.status)) {
    commitEvidence.push(`status:${order.status}`);
  }

  if (saleSummary.transactionCount > 0) {
    commitEvidence.push('sale_history');
  }

  for (const log of logs) {
    const toStatus = getMetadataString(log.metadata, 'toStatus');
    const fromStatus = getMetadataString(log.metadata, 'fromStatus');

    if (
      (log.action === 'ORDER_APPROVE' || log.action === 'ORDER_ADVANCE_STATUS') &&
      toStatus === 'PROCESSING'
    ) {
      commitEvidence.push(`audit:${log.action}`);
    }

    if (log.action === 'ORDER_CANCEL' && fromStatus === 'PROCESSING') {
      commitEvidence.push('audit:ORDER_CANCEL');
    }
  }

  if (order.status === 'CANCELLED' && order.paymentMethod === 'COD' && order.approvedAt) {
    commitEvidence.push('approved_at');
  }

  if (COMMITTED_STATUSES.has(order.status)) {
    return { state: 'COMMITTED', commitEvidence };
  }

  if (order.status === 'CANCELLED') {
    if (commitEvidence.length > 0) {
      return { state: 'COMMITTED_CANCELLED', commitEvidence };
    }

    return {
      state: 'AMBIGUOUS_CANCELLED',
      commitEvidence,
    };
  }

  return {
    state: 'NOT_COMMITTED',
    commitEvidence,
  };
}

function pushIssue(
  issues: ReconciliationIssue[],
  code: InventoryReconciliationIssueCodeValue,
  message: string,
  autoFixable = false,
): void {
  issues.push({
    code,
    message,
    autoFixable,
  });
}

function deriveAutoFixActions(
  analysis: InventoryReconciliationOrderRow,
): ReconciliationAction[] {
  const blockingCodes = new Set<InventoryReconciliationIssueCodeValue>([
    'DUPLICATE_SALE_HISTORY',
    'DUPLICATE_RETURN_HISTORY',
    'UNEXPECTED_SALE_HISTORY',
    'UNEXPECTED_RETURN_HISTORY',
    'SALE_QUANTITY_MISMATCH',
    'RETURN_QUANTITY_MISMATCH',
    'AMBIGUOUS_CANCELLED_ORDER',
  ]);

  if (analysis.issues.some((issue) => blockingCodes.has(issue.code))) {
    return [];
  }

  const actions: ReconciliationAction[] = [];

  if (analysis.issues.some((issue) => issue.code === 'MISSING_SALE_HISTORY')) {
    actions.push('BACKFILL_SALE_HISTORY');
  }

  if (analysis.issues.some((issue) => issue.code === 'MISSING_RETURN_HISTORY')) {
    actions.push('BACKFILL_RETURN_HISTORY');
  }

  return actions;
}

export interface InventoryReconciliationOrderRow {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: 'COD' | 'PROMPTPAY_QR';
  createdAt: Date;
  reconciliationState: ReconciliationState;
  commitEvidence: string[];
  expectedSaleQuantity: number;
  actualSaleQuantity: number;
  expectedReturnQuantity: number;
  actualReturnQuantity: number;
  expectedNetMovement: number;
  actualNetMovement: number;
  netMovementGap: number;
  issues: ReconciliationIssue[];
  suggestedActions: ReconciliationAction[];
  autoFixable: boolean;
  manualReviewRequired: boolean;
  stockReviewRecommended: boolean;
}

function analyzeOrder(
  order: OrderRow,
  saleRows: Array<{ productId: number; quantity: number }>,
  returnRows: Array<{ productId: number; quantity: number }>,
  logs: AuditLogRow[],
): InventoryReconciliationOrderRow {
  const expectedSummary = buildExpectedQuantitySummary(order.items);
  const saleSummary = buildActualQuantitySummary(saleRows);
  const returnSummary = buildActualQuantitySummary(returnRows);
  const committedState = deriveCommittedState(order, saleSummary, logs);

  const issues: ReconciliationIssue[] = [];

  const expectsSale =
    committedState.state === 'COMMITTED' ||
    committedState.state === 'COMMITTED_CANCELLED';
  const expectsReturn = committedState.state === 'COMMITTED_CANCELLED';

  if (committedState.state === 'AMBIGUOUS_CANCELLED') {
    pushIssue(
      issues,
      'AMBIGUOUS_CANCELLED_ORDER',
      'Cancelled order has no reliable evidence that inventory was ever committed',
    );
  }

  if (expectsSale && saleSummary.transactionCount === 0) {
    pushIssue(
      issues,
      'MISSING_SALE_HISTORY',
      'Committed order is missing SALE inventory history',
      true,
    );
  }

  if (expectsReturn && returnSummary.transactionCount === 0) {
    pushIssue(
      issues,
      'MISSING_RETURN_HISTORY',
      'Committed cancelled order is missing RETURN_IN inventory history',
      true,
    );
  }

  if (!expectsSale && saleSummary.transactionCount > 0) {
    pushIssue(
      issues,
      'UNEXPECTED_SALE_HISTORY',
      'SALE inventory history exists for an order that does not appear committed',
    );
  }

  if (!expectsReturn && returnSummary.transactionCount > 0) {
    pushIssue(
      issues,
      'UNEXPECTED_RETURN_HISTORY',
      'RETURN_IN inventory history exists for an order that does not appear committed and cancelled',
    );
  }

  if (saleSummary.transactionCount > expectedSummary.transactionCount) {
    pushIssue(
      issues,
      'DUPLICATE_SALE_HISTORY',
      'SALE inventory history has more rows than expected for this order',
    );
  }

  if (returnSummary.transactionCount > expectedSummary.transactionCount) {
    pushIssue(
      issues,
      'DUPLICATE_RETURN_HISTORY',
      'RETURN_IN inventory history has more rows than expected for this order',
    );
  }

  if (
    expectsSale &&
    saleSummary.transactionCount > 0 &&
    (saleSummary.totalQuantity !== expectedSummary.totalQuantity ||
      hasProductQuantityMismatch(expectedSummary, saleSummary))
  ) {
    pushIssue(
      issues,
      'SALE_QUANTITY_MISMATCH',
      `SALE inventory quantity mismatch. Expected ${String(expectedSummary.totalQuantity)}, found ${String(saleSummary.totalQuantity)}`,
    );
  }

  if (
    expectsReturn &&
    returnSummary.transactionCount > 0 &&
    (returnSummary.totalQuantity !== expectedSummary.totalQuantity ||
      hasProductQuantityMismatch(expectedSummary, returnSummary))
  ) {
    pushIssue(
      issues,
      'RETURN_QUANTITY_MISMATCH',
      `RETURN_IN inventory quantity mismatch. Expected ${String(expectedSummary.totalQuantity)}, found ${String(returnSummary.totalQuantity)}`,
    );
  }

  const expectedSaleQuantity = expectsSale ? expectedSummary.totalQuantity : 0;
  const expectedReturnQuantity = expectsReturn ? expectedSummary.totalQuantity : 0;
  const expectedNetMovement = expectedReturnQuantity - expectedSaleQuantity;
  const actualNetMovement = returnSummary.totalQuantity - saleSummary.totalQuantity;
  const netMovementGap = expectedNetMovement - actualNetMovement;

  const suggestedActions = deriveAutoFixActions({
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    reconciliationState: committedState.state,
    commitEvidence: committedState.commitEvidence,
    expectedSaleQuantity,
    actualSaleQuantity: saleSummary.totalQuantity,
    expectedReturnQuantity,
    actualReturnQuantity: returnSummary.totalQuantity,
    expectedNetMovement,
    actualNetMovement,
    netMovementGap,
    issues,
    suggestedActions: [],
    autoFixable: false,
    manualReviewRequired: false,
    stockReviewRecommended: false,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    reconciliationState: committedState.state,
    commitEvidence: committedState.commitEvidence,
    expectedSaleQuantity,
    actualSaleQuantity: saleSummary.totalQuantity,
    expectedReturnQuantity,
    actualReturnQuantity: returnSummary.totalQuantity,
    expectedNetMovement,
    actualNetMovement,
    netMovementGap,
    issues,
    suggestedActions,
    autoFixable: suggestedActions.length > 0,
    manualReviewRequired: issues.some((issue) => !issue.autoFixable),
    stockReviewRecommended: netMovementGap !== 0,
  };
}

async function analyzeOrdersByIds(
  orderIds: number[],
  client: ReconciliationClient,
) {
  if (orderIds.length === 0) {
    return [];
  }

  const orders = await client.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      approvedAt: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  });

  const inventoryRows = await client.inventoryTransaction.findMany({
    where: {
      referenceId: { in: orderIds },
      type: { in: ['SALE', 'RETURN_IN'] },
    },
    select: {
      referenceId: true,
      type: true,
      productId: true,
      quantity: true,
    },
  });

  const auditRows = await client.auditLog.findMany({
    where: {
      entityType: 'Order',
      entityId: { in: orderIds },
      action: { in: ['ORDER_APPROVE', 'ORDER_ADVANCE_STATUS', 'ORDER_CANCEL'] },
    },
    select: {
      entityId: true,
      action: true,
      metadata: true,
    },
  });

  const saleRowsByOrderId = new Map<
    number,
    Array<{ productId: number; quantity: number }>
  >();
  const returnRowsByOrderId = new Map<
    number,
    Array<{ productId: number; quantity: number }>
  >();
  const auditRowsByOrderId = new Map<number, AuditLogRow[]>();

  for (const row of inventoryRows) {
    if (row.referenceId === null) {
      continue;
    }

    const targetMap =
      row.type === 'SALE' ? saleRowsByOrderId : returnRowsByOrderId;
    const existingRows = targetMap.get(row.referenceId) ?? [];
    existingRows.push({
      productId: row.productId,
      quantity: row.quantity,
    });
    targetMap.set(row.referenceId, existingRows);
  }

  for (const row of auditRows) {
    if (row.entityId === null) {
      continue;
    }

    const existingRows = auditRowsByOrderId.get(row.entityId) ?? [];
    existingRows.push({
      action: row.action,
      metadata: row.metadata,
    });
    auditRowsByOrderId.set(row.entityId, existingRows);
  }

  const orderMap = new Map<number, InventoryReconciliationOrderRow>();

  for (const order of orders) {
    orderMap.set(
      order.id,
      analyzeOrder(
        order,
        saleRowsByOrderId.get(order.id) ?? [],
        returnRowsByOrderId.get(order.id) ?? [],
        auditRowsByOrderId.get(order.id) ?? [],
      ),
    );
  }

  return orderIds
    .map((orderId) => orderMap.get(orderId))
    .filter((row): row is InventoryReconciliationOrderRow => row !== undefined);
}

function buildReportSummary(rows: InventoryReconciliationOrderRow[]) {
  const issueCounts: Record<string, number> = {};

  for (const row of rows) {
    for (const issue of row.issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
    }
  }

  return {
    scannedOrders: rows.length,
    ordersWithIssues: rows.filter((row) => row.issues.length > 0).length,
    autoFixableOrders: rows.filter((row) => row.autoFixable).length,
    manualReviewOrders: rows.filter((row) => row.manualReviewRequired).length,
    issueCounts,
  };
}

export async function getInventoryReconciliationReport(
  query: InventoryReconciliationReportQuery,
) {
  const where = buildOrderWhere(query);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.order.count({ where }),
  ]);

  const orderIds = orders.map((order) => order.id);
  const data = await analyzeOrdersByIds(orderIds, prisma);

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
    summary: buildReportSummary(data),
  };
}

interface ReconciliationBackfillResult {
  orderId: number;
  orderNumber: string | null;
  status: 'planned' | 'applied' | 'skipped' | 'failed';
  plannedActions: ReconciliationAction[];
  appliedActions: ReconciliationAction[];
  issues: ReconciliationIssue[];
  manualReviewRequired: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export async function runInventoryReconciliationBackfill(
  body: InventoryReconciliationBackfillBody,
  actorUserId: number,
) {
  const uniqueOrderIds = [...new Set(body.orderIds)];
  const analysisRows = await analyzeOrdersByIds(uniqueOrderIds, prisma);
  const analysisByOrderId = new Map(
    analysisRows.map((row) => [row.orderId, row] as const),
  );

  const results: ReconciliationBackfillResult[] = [];

  for (const orderId of uniqueOrderIds) {
    const analysis = analysisByOrderId.get(orderId);

    if (!analysis) {
      results.push({
        orderId,
        orderNumber: null,
        status: 'failed',
        plannedActions: [],
        appliedActions: [],
        issues: [],
        manualReviewRequired: true,
        error: {
          code: 'NOT_FOUND',
          message: 'Order not found',
        },
      });
      continue;
    }

    const plannedActions = deriveAutoFixActions(analysis);

    if (body.dryRun) {
      results.push({
        orderId,
        orderNumber: analysis.orderNumber,
        status: plannedActions.length > 0 ? 'planned' : 'skipped',
        plannedActions,
        appliedActions: [],
        issues: analysis.issues,
        manualReviewRequired: analysis.manualReviewRequired,
      });
      continue;
    }

    if (plannedActions.length === 0) {
      results.push({
        orderId,
        orderNumber: analysis.orderNumber,
        status: 'skipped',
        plannedActions,
        appliedActions: [],
        issues: analysis.issues,
        manualReviewRequired: analysis.manualReviewRequired,
      });
      continue;
    }

    try {
      const appliedActions = await prisma.$transaction(async (tx) => {
        const [currentAnalysis] = await analyzeOrdersByIds([orderId], tx);
        if (!currentAnalysis) {
          return [] as ReconciliationAction[];
        }

        const currentActions = deriveAutoFixActions(currentAnalysis);
        const applied: ReconciliationAction[] = [];

        if (currentActions.includes('BACKFILL_SALE_HISTORY')) {
          await backfillOrderSaleHistory(tx, orderId, actorUserId);
          applied.push('BACKFILL_SALE_HISTORY');
        }

        if (currentActions.includes('BACKFILL_RETURN_HISTORY')) {
          await backfillOrderReturnHistory(tx, orderId, actorUserId);
          applied.push('BACKFILL_RETURN_HISTORY');
        }

        return applied;
      });

      results.push({
        orderId,
        orderNumber: analysis.orderNumber,
        status: appliedActions.length > 0 ? 'applied' : 'skipped',
        plannedActions,
        appliedActions,
        issues: analysis.issues,
        manualReviewRequired: analysis.manualReviewRequired,
      });
    } catch (error) {
      const appError =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'message' in error
          ? (error as { code: string; message: string })
          : null;

      results.push({
        orderId,
        orderNumber: analysis.orderNumber,
        status: 'failed',
        plannedActions,
        appliedActions: [],
        issues: analysis.issues,
        manualReviewRequired: true,
        error: {
          code: appError?.code ?? 'INTERNAL_ERROR',
          message: appError?.message ?? 'Reconciliation backfill failed',
        },
      });
    }
  }

  await logActionBestEffort({
    actorUserId,
    action: body.dryRun
      ? 'INVENTORY_RECONCILIATION_DRY_RUN'
      : 'INVENTORY_RECONCILIATION_APPLY',
    entityType: 'Order',
    entityId: null,
    metadata: {
      dryRun: body.dryRun,
      orderIds: uniqueOrderIds,
      plannedOrderCount: results.filter((result) => result.status === 'planned').length,
      appliedOrderCount: results.filter((result) => result.status === 'applied').length,
      skippedOrderCount: results.filter((result) => result.status === 'skipped').length,
      failedOrderCount: results.filter((result) => result.status === 'failed').length,
    },
  });

  return {
    dryRun: body.dryRun,
    results,
    summary: {
      requestedOrders: uniqueOrderIds.length,
      plannedOrders: results.filter((result) => result.status === 'planned').length,
      appliedOrders: results.filter((result) => result.status === 'applied').length,
      skippedOrders: results.filter((result) => result.status === 'skipped').length,
      failedOrders: results.filter((result) => result.status === 'failed').length,
    },
  };
}
