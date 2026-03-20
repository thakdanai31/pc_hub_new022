import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { sendPaginatedSuccess } from '../../common/pagination.js';
import { getAuthUser } from '../../middleware/auth.js';
import {
  claimIdParamSchema,
  createClaimBodySchema,
  myClaimListQuerySchema,
} from './claim.schema.js';
import * as claimService from './claim.service.js';

export async function createClaim(req: Request, res: Response): Promise<void> {
  const body = createClaimBodySchema.parse(req.body);
  const claim = await claimService.createClaim(getAuthUser(req).userId, body);

  sendSuccess({
    res,
    message: 'Claim created',
    data: claim,
    statusCode: 201,
  });
}

export async function listMyClaims(req: Request, res: Response): Promise<void> {
  const query = myClaimListQuerySchema.parse(req.query);
  const result = await claimService.getMyClaims(getAuthUser(req).userId, query);

  sendPaginatedSuccess({
    res,
    message: 'Claims retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function getMyClaim(req: Request, res: Response): Promise<void> {
  const { claimId } = claimIdParamSchema.parse(req.params);
  const claim = await claimService.getMyClaimById(
    claimId,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Claim retrieved',
    data: claim,
  });
}
