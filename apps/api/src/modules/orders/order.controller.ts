import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { sendPaginatedSuccess } from '../../common/pagination.js';
import { orderIdParamSchema, orderListQuerySchema } from './order.schema.js';
import * as orderService from './order.service.js';
import { AppError } from '../../common/errors.js';
import { getAuthUser } from '../../middleware/auth.js';

export async function listMyOrders(req: Request, res: Response) {
  const query = orderListQuerySchema.parse(req.query);
  const result = await orderService.listMyOrders(getAuthUser(req).userId, query);
  sendPaginatedSuccess({
    res,
    message: 'Orders retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getMyOrder(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const order = await orderService.getMyOrder(orderId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Order retrieved', data: order });
}

export async function getMyPayment(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const payment = await orderService.getMyPayment(orderId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Payment retrieved', data: payment });
}

export async function getPromptPayQR(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const qr = await orderService.getPromptPayQR(orderId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'PromptPay QR generated', data: qr });
}

export async function uploadPaymentSlip(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);

  if (!req.file) {
    throw new AppError('Payment slip image is required', 400, 'MISSING_FILE');
  }

  const result = await orderService.uploadPaymentSlip(orderId, getAuthUser(req).userId, req.file);
  sendSuccess({ res, message: 'Payment slip uploaded', data: result, statusCode: 201 });
}
