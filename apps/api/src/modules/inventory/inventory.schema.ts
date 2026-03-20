import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../common/pagination.js';

export const inventoryTransactionTypeSchema = z.enum([
  'RESTOCK',
  'SALE',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'RETURN_IN',
  'RETURN_OUT',
]);

export type InventoryTransactionTypeValue = z.infer<typeof inventoryTransactionTypeSchema>;

export const inventoryMutationBodySchema = z.object({
  quantity: z.coerce.number().int().positive(),
  referenceId: z.coerce.number().int().positive().optional(),
  note: z.string().trim().min(1).max(1000).optional(),
});

export type InventoryMutationBody = z.infer<typeof inventoryMutationBodySchema>;

export const inventoryTransactionListQuerySchema = paginationQuerySchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  type: inventoryTransactionTypeSchema.optional(),
  referenceId: z.coerce.number().int().positive().optional(),
});

export type InventoryTransactionListQuery = z.infer<typeof inventoryTransactionListQuerySchema>;

export const productInventoryTransactionListQuerySchema =
  inventoryTransactionListQuerySchema.omit({ productId: true });

export type ProductInventoryTransactionListQuery = z.infer<
  typeof productInventoryTransactionListQuerySchema
>;

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const inventoryReconciliationOrderStatusSchema = z.enum([
  'PENDING',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_REVIEW',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const inventoryReconciliationIssueCodeSchema = z.enum([
  'MISSING_SALE_HISTORY',
  'MISSING_RETURN_HISTORY',
  'DUPLICATE_SALE_HISTORY',
  'DUPLICATE_RETURN_HISTORY',
  'UNEXPECTED_SALE_HISTORY',
  'UNEXPECTED_RETURN_HISTORY',
  'SALE_QUANTITY_MISMATCH',
  'RETURN_QUANTITY_MISMATCH',
  'AMBIGUOUS_CANCELLED_ORDER',
]);

export type InventoryReconciliationIssueCodeValue = z.infer<
  typeof inventoryReconciliationIssueCodeSchema
>;

export const inventoryReconciliationReportQuerySchema =
  paginationQuerySchema.extend({
    orderId: z.coerce.number().int().positive().optional(),
    status: inventoryReconciliationOrderStatusSchema.optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  });

export type InventoryReconciliationReportQuery = z.infer<
  typeof inventoryReconciliationReportQuerySchema
>;

export const inventoryReconciliationBackfillBodySchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1).max(100),
  dryRun: z.boolean().default(true),
});

export type InventoryReconciliationBackfillBody = z.infer<
  typeof inventoryReconciliationBackfillBodySchema
>;
