import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../../common/pagination.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categoryAdminListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

export type CategoryAdminListQuery = z.infer<typeof categoryAdminListQuerySchema>;

export const categoryIdParamSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
});

export const createCategoryBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  parentId: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;

export const updateCategoryBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().max(1000).optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
