import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { imageUpload } from '../../config/upload.js';
import * as orderController from './order.controller.js';

export const orderRouter = Router();

orderRouter.use(requireAuth, requireRole('CUSTOMER', 'STAFF', 'ADMIN'));

orderRouter.get('/', orderController.listMyOrders);
orderRouter.get('/:orderId', orderController.getMyOrder);
orderRouter.get('/:orderId/payment', orderController.getMyPayment);
orderRouter.get('/:orderId/promptpay', orderController.getPromptPayQR);
orderRouter.post(
  '/:orderId/payment-slip',
  imageUpload.single('slip'),
  orderController.uploadPaymentSlip,
);
