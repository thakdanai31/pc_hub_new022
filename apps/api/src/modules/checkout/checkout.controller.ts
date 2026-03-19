import type { Request, Response } from 'express';
import * as checkoutService from './checkout.service.js';
import {
  cartCheckoutBodySchema,
  buyNowCheckoutBodySchema,
  orderNumberParamSchema,
} from './checkout.schema.js';
import { sendSuccess } from '../../common/response.js';
import { getAuthUser } from '../../middleware/auth.js';

export async function checkoutFromCart(req: Request, res: Response): Promise<void> {
  const body = cartCheckoutBodySchema.parse(req.body);
  const order = await checkoutService.checkoutFromCart(getAuthUser(req).userId, body);
  sendSuccess({ res, message: 'Order placed successfully', data: order, statusCode: 201 });
}

export async function buyNowCheckout(req: Request, res: Response): Promise<void> {
  const body = buyNowCheckoutBodySchema.parse(req.body);
  const order = await checkoutService.buyNowCheckout(getAuthUser(req).userId, body);
  sendSuccess({ res, message: 'Order placed successfully', data: order, statusCode: 201 });
}

export async function getConfirmation(req: Request, res: Response): Promise<void> {
  const { orderNumber } = orderNumberParamSchema.parse(req.params);
  const confirmation = await checkoutService.getConfirmation(orderNumber, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Order confirmation retrieved', data: confirmation });
}
