import type { Request, Response } from 'express';
import { AppError } from '../../../common/errors.js';
import * as productAdminService from './product-admin.service.js';
import {
  productAdminListQuerySchema,
  productIdParamSchema,
  imageIdParamSchema,
  createProductBodySchema,
  updateProductBodySchema,
  imageUploadBodySchema,
} from './product-admin.schema.js';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import { getAuthUser } from '../../../middleware/auth.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = productAdminListQuerySchema.parse(req.query);
  const result = await productAdminService.listProducts(query);

  sendPaginatedSuccess({
    res,
    message: 'Products retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function get(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const product = await productAdminService.getProduct(productId);

  sendSuccess({ res, message: 'Product retrieved', data: product });
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = createProductBodySchema.parse(req.body);
  const product = await productAdminService.createProduct(body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Product created', data: product, statusCode: 201 });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const body = updateProductBodySchema.parse(req.body);
  const product = await productAdminService.updateProduct(productId, body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Product updated', data: product });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  await productAdminService.deleteProduct(productId, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Product deleted' });
}

export async function toggleActive(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const result = await productAdminService.toggleActive(productId, getAuthUser(req).userId);

  const action = result.isActive ? 'activated' : 'deactivated';
  sendSuccess({ res, message: `Product ${action}`, data: result });
}

export async function uploadImage(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);

  if (!req.file) {
    throw new AppError('Image file is required', 400, 'FILE_REQUIRED');
  }

  const body = imageUploadBodySchema.parse(req.body);
  const image = await productAdminService.uploadProductImage(
    productId,
    req.file,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({ res, message: 'Image uploaded', data: image, statusCode: 201 });
}

export async function deleteImage(req: Request, res: Response): Promise<void> {
  const { productId, imageId } = imageIdParamSchema.parse(req.params);
  await productAdminService.deleteProductImage(productId, imageId, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Image deleted' });
}
