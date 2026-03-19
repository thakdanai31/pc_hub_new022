import { z } from 'zod/v4';
import { paginationQuerySchema } from '../../../common/pagination.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productAdminListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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

export type ProductAdminListQuery = z.infer<typeof productAdminListQuerySchema>;

export const productIdParamSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

export const imageIdParamSchema = z.object({
  productId: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const createProductBodySchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  brandId: z.coerce.number().int().positive(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens'),
  sku: z.string().min(1).max(50),
  description: z.string().max(5000),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0).default(0),
  warrantyMonths: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateProductBody = z.infer<typeof createProductBodySchema>;

export const updateProductBodySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).regex(slugPattern, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  sku: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
  price: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  warrantyMonths: z.coerce.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

export const imageUploadBodySchema = z.object({
  altText: z.string().max(255).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type ImageUploadBody = z.infer<typeof imageUploadBodySchema>;
