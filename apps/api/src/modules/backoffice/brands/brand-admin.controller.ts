import type { Request, Response } from 'express';
import * as brandAdminService from './brand-admin.service.js';
import {
  brandAdminListQuerySchema,
  brandIdParamSchema,
  createBrandBodySchema,
  updateBrandBodySchema,
} from './brand-admin.schema.js';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import { getAuthUser } from '../../../middleware/auth.js';
import { AppError } from '../../../common/errors.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = brandAdminListQuerySchema.parse(req.query);
  const result = await brandAdminService.listBrands(query);

  sendPaginatedSuccess({
    res,
    message: 'Brands retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = createBrandBodySchema.parse(req.body);
  const brand = await brandAdminService.createBrand(body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Brand created', data: brand, statusCode: 201 });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { brandId } = brandIdParamSchema.parse(req.params);
  const body = updateBrandBodySchema.parse(req.body);
  const brand = await brandAdminService.updateBrand(brandId, body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Brand updated', data: brand });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { brandId } = brandIdParamSchema.parse(req.params);
  await brandAdminService.deleteBrand(brandId, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Brand deleted' });
}

export async function toggleActive(req: Request, res: Response): Promise<void> {
  const { brandId } = brandIdParamSchema.parse(req.params);
  const result = await brandAdminService.toggleActive(brandId, getAuthUser(req).userId);

  const action = result.isActive ? 'activated' : 'deactivated';
  sendSuccess({ res, message: `Brand ${action}`, data: result });
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  const { brandId } = brandIdParamSchema.parse(req.params);

  if (!req.file) {
    throw new AppError('Logo image file is required', 400, 'FILE_REQUIRED');
  }

  const brand = await brandAdminService.uploadBrandLogo(brandId, req.file, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Brand logo uploaded', data: brand });
}
