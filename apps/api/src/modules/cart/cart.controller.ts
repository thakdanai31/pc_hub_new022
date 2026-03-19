import type { Request, Response } from 'express';
import * as cartService from './cart.service.js';
import {
  addCartItemBodySchema,
  updateCartItemBodySchema,
  cartItemIdParamSchema,
} from './cart.schema.js';
import { sendSuccess } from '../../common/response.js';
import { getAuthUser } from '../../middleware/auth.js';

export async function getCart(req: Request, res: Response): Promise<void> {
  const cart = await cartService.getCart(getAuthUser(req).userId);
  sendSuccess({ res, message: 'Cart retrieved', data: cart });
}

export async function addItem(req: Request, res: Response): Promise<void> {
  const body = addCartItemBodySchema.parse(req.body);
  const cart = await cartService.addItem(getAuthUser(req).userId, body);
  sendSuccess({ res, message: 'Item added to cart', data: cart, statusCode: 201 });
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const { cartItemId } = cartItemIdParamSchema.parse(req.params);
  const body = updateCartItemBodySchema.parse(req.body);
  const cart = await cartService.updateItem(getAuthUser(req).userId, cartItemId, body);
  sendSuccess({ res, message: 'Cart item updated', data: cart });
}

export async function removeItem(req: Request, res: Response): Promise<void> {
  const { cartItemId } = cartItemIdParamSchema.parse(req.params);
  const cart = await cartService.removeItem(getAuthUser(req).userId, cartItemId);
  sendSuccess({ res, message: 'Cart item removed', data: cart });
}

export async function clearCart(req: Request, res: Response): Promise<void> {
  const cart = await cartService.clearCart(getAuthUser(req).userId);
  sendSuccess({ res, message: 'Cart cleared', data: cart });
}
