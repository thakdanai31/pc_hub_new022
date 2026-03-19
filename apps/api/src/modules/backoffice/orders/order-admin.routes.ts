import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as orderAdminController from './order-admin.controller.js';

export const orderAdminRouter = Router();

orderAdminRouter.use(requireRole('STAFF', 'ADMIN'));

orderAdminRouter.get('/', orderAdminController.listOrders);
orderAdminRouter.get('/:orderId', orderAdminController.getOrder);
orderAdminRouter.post('/:orderId/approve', orderAdminController.approveOrder);
orderAdminRouter.post('/:orderId/reject', orderAdminController.rejectOrder);
orderAdminRouter.post('/:orderId/status', orderAdminController.advanceStatus);
