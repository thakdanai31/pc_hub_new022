import { Router } from 'express';
import * as cartController from './cart.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import {
  addCartItemBodySchema,
  updateCartItemBodySchema,
  cartItemIdParamSchema,
} from './cart.schema.js';

export const cartRouter = Router();

cartRouter.use(requireAuth, requireRole('CUSTOMER', 'STAFF', 'ADMIN'));

cartRouter.get('/', cartController.getCart);

cartRouter.post(
  '/items',
  validate({ body: addCartItemBodySchema }),
  cartController.addItem,
);

cartRouter.patch(
  '/items/:cartItemId',
  validate({ params: cartItemIdParamSchema, body: updateCartItemBodySchema }),
  cartController.updateItem,
);

cartRouter.delete(
  '/items/:cartItemId',
  validate({ params: cartItemIdParamSchema }),
  cartController.removeItem,
);

cartRouter.delete('/', cartController.clearCart);
