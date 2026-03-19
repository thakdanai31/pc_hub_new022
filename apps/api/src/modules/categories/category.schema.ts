import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../common/pagination.js';

export const categoryListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;

export const categoryIdParamSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
});
