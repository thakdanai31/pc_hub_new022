import type { Request, Response } from 'express';
import * as categoryService from './category.service.js';
import { categoryListQuerySchema, categoryIdParamSchema } from './category.schema.js';
import { sendSuccess } from '../../common/response.js';
import { sendPaginatedSuccess } from '../../common/pagination.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = categoryListQuerySchema.parse(req.query);
  const result = await categoryService.listCategories(query);

  sendPaginatedSuccess({
    res,
    message: 'Categories retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { categoryId } = categoryIdParamSchema.parse(req.params);
  const category = await categoryService.getCategoryById(categoryId);

  sendSuccess({ res, message: 'Category retrieved', data: category });
}
