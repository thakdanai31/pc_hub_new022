import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as claimAdminController from './claim-admin.controller.js';

export const claimAdminRouter = Router();

claimAdminRouter.use(requireRole('STAFF', 'ADMIN'));

claimAdminRouter.get('/', claimAdminController.listClaims);
claimAdminRouter.get('/:claimId', claimAdminController.getClaim);
claimAdminRouter.patch('/:claimId/status', claimAdminController.updateClaimStatus);
claimAdminRouter.patch(
  '/:claimId/admin-note',
  claimAdminController.updateClaimAdminNote,
);
