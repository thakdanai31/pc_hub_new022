import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import { getAuthUser } from '../../../middleware/auth.js';
import {
  adminClaimListQuerySchema,
  claimIdParamSchema,
  updateClaimAdminNoteBodySchema,
  updateClaimStatusBodySchema,
} from '../../claims/claim.schema.js';
import * as claimService from '../../claims/claim.service.js';

export async function listClaims(req: Request, res: Response): Promise<void> {
  const query = adminClaimListQuerySchema.parse(req.query);
  const result = await claimService.getClaimsForAdmin(query);

  sendPaginatedSuccess({
    res,
    message: 'Claims retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getClaim(req: Request, res: Response): Promise<void> {
  const { claimId } = claimIdParamSchema.parse(req.params);
  const claim = await claimService.getClaimForAdmin(claimId);

  sendSuccess({
    res,
    message: 'Claim retrieved',
    data: claim,
  });
}

export async function updateClaimStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const { claimId } = claimIdParamSchema.parse(req.params);
  const body = updateClaimStatusBodySchema.parse(req.body);
  const claim = await claimService.updateClaimStatus(
    claimId,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Claim status updated',
    data: claim,
  });
}

export async function updateClaimAdminNote(
  req: Request,
  res: Response,
): Promise<void> {
  const { claimId } = claimIdParamSchema.parse(req.params);
  const body = updateClaimAdminNoteBodySchema.parse(req.body);
  const claim = await claimService.updateClaimAdminNote(
    claimId,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Claim admin note updated',
    data: claim,
  });
}
