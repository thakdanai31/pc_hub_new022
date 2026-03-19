import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../common/pagination.js';

export const brandListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

export type BrandListQuery = z.infer<typeof brandListQuerySchema>;

export const brandIdParamSchema = z.object({
  brandId: z.coerce.number().int().positive(),
});
