import { Router } from 'express';
import * as addressController from './address.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import {
  createAddressBodySchema,
  updateAddressBodySchema,
  addressIdParamSchema,
} from './address.schema.js';

export const addressRouter = Router();

// All address routes require authenticated customer
addressRouter.use(requireAuth, requireRole('CUSTOMER', 'STAFF', 'ADMIN'));

addressRouter.get('/', addressController.list);

addressRouter.post(
  '/',
  validate({ body: createAddressBodySchema }),
  addressController.create,
);

addressRouter.patch(
  '/:addressId',
  validate({ params: addressIdParamSchema, body: updateAddressBodySchema }),
  addressController.update,
);

addressRouter.delete(
  '/:addressId',
  validate({ params: addressIdParamSchema }),
  addressController.remove,
);

addressRouter.post(
  '/:addressId/default',
  validate({ params: addressIdParamSchema }),
  addressController.setDefault,
);
