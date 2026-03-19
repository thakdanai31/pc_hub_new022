import type { Request, Response } from 'express';
import * as categoryAdminService from './category-admin.service.js';
import {
  categoryAdminListQuerySchema,
  categoryIdParamSchema,
  createCategoryBodySchema,
  updateCategoryBodySchema,
} from './category-admin.schema.js';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import { getAuthUser } from '../../../middleware/auth.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = categoryAdminListQuerySchema.parse(req.query);
  const result = await categoryAdminService.listCategories(query);

  sendPaginatedSuccess({
    res,
    message: 'Categories retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = createCategoryBodySchema.parse(req.body);
  const category = await categoryAdminService.createCategory(body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Category created', data: category, statusCode: 201 });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { categoryId } = categoryIdParamSchema.parse(req.params);
  const body = updateCategoryBodySchema.parse(req.body);
  const category = await categoryAdminService.updateCategory(categoryId, body, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Category updated', data: category });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { categoryId } = categoryIdParamSchema.parse(req.params);
  await categoryAdminService.deleteCategory(categoryId, getAuthUser(req).userId);

  sendSuccess({ res, message: 'Category deleted' });
}

export async function toggleActive(req: Request, res: Response): Promise<void> {
  const { categoryId } = categoryIdParamSchema.parse(req.params);
  const result = await categoryAdminService.toggleActive(categoryId, getAuthUser(req).userId);

  const action = result.isActive ? 'activated' : 'deactivated';
  sendSuccess({ res, message: `Category ${action}`, data: result });
}
