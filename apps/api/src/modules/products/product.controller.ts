import type { Request, Response } from 'express';
import * as productService from './product.service.js';
import {
  productListQuerySchema,
  productIdParamSchema,
  productSlugParamSchema,
} from './product.schema.js';
import { sendSuccess } from '../../common/response.js';
import { sendPaginatedSuccess } from '../../common/pagination.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = productListQuerySchema.parse(req.query);
  const result = await productService.listProducts(query);

  sendPaginatedSuccess({
    res,
    message: 'Products retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const product = await productService.getProductById(productId);

  sendSuccess({ res, message: 'Product retrieved', data: product });
}

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const { slug } = productSlugParamSchema.parse(req.params);
  const product = await productService.getProductBySlug(slug);

  sendSuccess({ res, message: 'Product retrieved', data: product });
}
