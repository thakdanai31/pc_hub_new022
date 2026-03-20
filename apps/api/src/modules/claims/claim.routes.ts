import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/role.js';
import { validate } from '../../middleware/validate.js';
import * as claimController from './claim.controller.js';
import {
  claimIdParamSchema,
  createClaimBodySchema,
} from './claim.schema.js';

export const claimRouter = Router();

claimRouter.use(requireAuth, requireRole('CUSTOMER', 'STAFF', 'ADMIN'));

claimRouter.get('/', claimController.listMyClaims);

claimRouter.post(
  '/',
  validate({ body: createClaimBodySchema }),
  claimController.createClaim,
);

claimRouter.get(
  '/:claimId',
  validate({ params: claimIdParamSchema }),
  claimController.getMyClaim,
);
