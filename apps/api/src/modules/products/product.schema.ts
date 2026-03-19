import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../common/pagination.js';

export const productListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .enum([
      'price_asc',
      'price_desc',
      'newest',
      'oldest',
      'name_asc',
      'name_desc',
    ])
    .default('newest'),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const productSlugParamSchema = z.object({
  slug: z.string().min(1).max(255),
});
