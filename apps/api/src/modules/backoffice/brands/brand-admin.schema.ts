import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../../common/pagination.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const brandAdminListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

export type BrandAdminListQuery = z.infer<typeof brandAdminListQuerySchema>;

export const brandIdParamSchema = z.object({
  brandId: z.coerce.number().int().positive(),
});

export const createBrandBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
  isActive: z.boolean().optional(),
});

export type CreateBrandBody = z.infer<typeof createBrandBodySchema>;

export const updateBrandBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  isActive: z.boolean().optional(),
});

export type UpdateBrandBody = z.infer<typeof updateBrandBodySchema>;
