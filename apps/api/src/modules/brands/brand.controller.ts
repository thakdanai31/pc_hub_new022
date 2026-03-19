import type { Request, Response } from 'express';
import * as brandService from './brand.service.js';
import { brandListQuerySchema, brandIdParamSchema } from './brand.schema.js';
import { sendSuccess } from '../../common/response.js';
import { sendPaginatedSuccess } from '../../common/pagination.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = brandListQuerySchema.parse(req.query);
  const result = await brandService.listBrands(query);

  sendPaginatedSuccess({
    res,
    message: 'Brands retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { brandId } = brandIdParamSchema.parse(req.params);
  const brand = await brandService.getBrandById(brandId);

  sendSuccess({ res, message: 'Brand retrieved', data: brand });
}
