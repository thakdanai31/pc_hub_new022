import { Router } from 'express';
import * as checkoutController from './checkout.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import {
  cartCheckoutBodySchema,
  buyNowCheckoutBodySchema,
  orderNumberParamSchema,
} from './checkout.schema.js';

export const checkoutRouter = Router();

checkoutRouter.use(requireAuth, requireRole('CUSTOMER', 'STAFF', 'ADMIN'));

checkoutRouter.post(
  '/cart',
  validate({ body: cartCheckoutBodySchema }),
  checkoutController.checkoutFromCart,
);

checkoutRouter.post(
  '/buy-now',
  validate({ body: buyNowCheckoutBodySchema }),
  checkoutController.buyNowCheckout,
);

checkoutRouter.get(
  '/confirmation/:orderNumber',
  validate({ params: orderNumberParamSchema }),
  checkoutController.getConfirmation,
);
