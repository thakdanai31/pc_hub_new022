import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../common/pagination.js';

export const claimStatusSchema = z.enum([
  'PENDING',
  'IN_REVIEW',
  'SENT_TO_MANUFACTURER',
  'COMPLETED',
  'REJECTED',
]);

export type ClaimStatusValue = z.infer<typeof claimStatusSchema>;

export const claimIdParamSchema = z.object({
  claimId: z.coerce.number().int().positive(),
});

export const createClaimBodySchema = z.object({
  orderId: z.number().int().positive(),
  productId: z.number().int().positive(),
  issueDescription: z.string().trim().min(1).max(5000),
});

export type CreateClaimBody = z.infer<typeof createClaimBodySchema>;

export const myClaimListQuerySchema = paginationQuerySchema.extend({
  status: claimStatusSchema.optional(),
});

export type MyClaimListQuery = z.infer<typeof myClaimListQuerySchema>;

export const adminClaimListQuerySchema = paginationQuerySchema.extend({
  status: claimStatusSchema.optional(),
  userId: z.coerce.number().int().positive().optional(),
  orderId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
});

export type AdminClaimListQuery = z.infer<typeof adminClaimListQuerySchema>;

export const updateClaimStatusBodySchema = z.object({
  status: claimStatusSchema,
});

export type UpdateClaimStatusBody = z.infer<typeof updateClaimStatusBodySchema>;

export const updateClaimAdminNoteBodySchema = z.object({
  adminNote: z.union([z.string().trim().min(1).max(5000), z.null()]),
});

export type UpdateClaimAdminNoteBody = z.infer<typeof updateClaimAdminNoteBodySchema>;
