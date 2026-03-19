import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import {
  userListQuerySchema,
  createPrivilegedUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from './user-admin.schema.js';
import * as userAdminService from './user-admin.service.js';
import { getAuthUser } from '../../../middleware/auth.js';

export async function listUsers(req: Request, res: Response) {
  const query = userListQuerySchema.parse(req.query);
  const result = await userAdminService.listUsers(query);
  sendPaginatedSuccess({
    res,
    message: 'Users retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function createStaff(req: Request, res: Response) {
  const body = createPrivilegedUserSchema.parse(req.body);
  const user = await userAdminService.createPrivilegedUser(body, 'STAFF', getAuthUser(req).userId);
  sendSuccess({ res, message: 'Staff user created', data: user, statusCode: 201 });
}

export async function createAdmin(req: Request, res: Response) {
  const body = createPrivilegedUserSchema.parse(req.body);
  const user = await userAdminService.createPrivilegedUser(body, 'ADMIN', getAuthUser(req).userId);
  sendSuccess({ res, message: 'Admin user created', data: user, statusCode: 201 });
}

export async function updateUser(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const body = updateUserSchema.parse(req.body);
  const user = await userAdminService.updateUser(userId, body, getAuthUser(req).userId);
  sendSuccess({ res, message: 'User updated', data: user });
}

export async function disableUser(req: Request, res: Response) {
  const { userId } = userIdParamSchema.parse(req.params);
  const user = await userAdminService.disableUser(userId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'User disabled', data: user });
}
