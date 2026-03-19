import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import { imageUpload } from '../../../config/upload.js';
import * as brandAdminController from './brand-admin.controller.js';

export const brandAdminRouter = Router();

brandAdminRouter.get(
  '/',
  requireRole('STAFF', 'ADMIN'),
  brandAdminController.list,
);

brandAdminRouter.post(
  '/',
  requireRole('ADMIN'),
  brandAdminController.create,
);

brandAdminRouter.patch(
  '/:brandId',
  requireRole('ADMIN'),
  brandAdminController.update,
);

brandAdminRouter.delete(
  '/:brandId',
  requireRole('ADMIN'),
  brandAdminController.remove,
);

brandAdminRouter.post(
  '/:brandId/toggle-active',
  requireRole('STAFF', 'ADMIN'),
  brandAdminController.toggleActive,
);

brandAdminRouter.post(
  '/:brandId/logo',
  requireRole('ADMIN'),
  imageUpload.single('logo'),
  brandAdminController.uploadLogo,
);
