import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import { imageUpload } from '../../../config/upload.js';
import * as productAdminController from './product-admin.controller.js';

export const productAdminRouter = Router();

productAdminRouter.get(
  '/',
  requireRole('STAFF', 'ADMIN'),
  productAdminController.list,
);

productAdminRouter.post(
  '/',
  requireRole('ADMIN'),
  productAdminController.create,
);

productAdminRouter.get(
  '/:productId',
  requireRole('STAFF', 'ADMIN'),
  productAdminController.get,
);

productAdminRouter.patch(
  '/:productId',
  requireRole('ADMIN'),
  productAdminController.update,
);

productAdminRouter.delete(
  '/:productId',
  requireRole('ADMIN'),
  productAdminController.remove,
);

productAdminRouter.post(
  '/:productId/toggle-active',
  requireRole('STAFF', 'ADMIN'),
  productAdminController.toggleActive,
);

productAdminRouter.post(
  '/:productId/images',
  requireRole('ADMIN'),
  imageUpload.single('image'),
  productAdminController.uploadImage,
);

productAdminRouter.delete(
  '/:productId/images/:imageId',
  requireRole('ADMIN'),
  productAdminController.deleteImage,
);
