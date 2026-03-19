import { z } from 'zod/v4';

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive(),
});

export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

const orderStatusEnum = z.enum([
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

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: orderStatusEnum.optional(),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
