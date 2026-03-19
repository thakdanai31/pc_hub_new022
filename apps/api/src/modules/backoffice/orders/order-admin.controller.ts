import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import {
  backofficeOrderListQuerySchema,
  orderIdParamSchema,
  rejectBodySchema,
  advanceStatusBodySchema,
} from './order-admin.schema.js';
import * as orderService from '../../orders/order.service.js';
import { getAuthUser } from '../../../middleware/auth.js';

export async function listOrders(req: Request, res: Response) {
  const query = backofficeOrderListQuerySchema.parse(req.query);
  const result = await orderService.listOrdersForReview(query);
  sendPaginatedSuccess({
    res,
    message: 'Orders retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getOrder(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const order = await orderService.getOrderForReview(orderId);
  sendSuccess({ res, message: 'Order retrieved', data: order });
}

export async function approveOrder(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const result = await orderService.approveOrder(orderId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Order approved', data: result });
}

export async function rejectOrder(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const { reason } = rejectBodySchema.parse(req.body);
  const result = await orderService.rejectOrder(orderId, getAuthUser(req).userId, reason);
  sendSuccess({ res, message: 'Order rejected', data: result });
}

export async function advanceStatus(req: Request, res: Response) {
  const { orderId } = orderIdParamSchema.parse(req.params);
  const { status } = advanceStatusBodySchema.parse(req.body);
  const result = await orderService.advanceOrderStatus(orderId, status, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Order status updated', data: result });
}
