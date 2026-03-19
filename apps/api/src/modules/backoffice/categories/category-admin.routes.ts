import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as categoryAdminController from './category-admin.controller.js';

export const categoryAdminRouter = Router();

categoryAdminRouter.get(
  '/',
  requireRole('STAFF', 'ADMIN'),
  categoryAdminController.list,
);

categoryAdminRouter.post(
  '/',
  requireRole('ADMIN'),
  categoryAdminController.create,
);

categoryAdminRouter.patch(
  '/:categoryId',
  requireRole('ADMIN'),
  categoryAdminController.update,
);

categoryAdminRouter.delete(
  '/:categoryId',
  requireRole('ADMIN'),
  categoryAdminController.remove,
);

categoryAdminRouter.post(
  '/:categoryId/toggle-active',
  requireRole('STAFF', 'ADMIN'),
  categoryAdminController.toggleActive,
);
