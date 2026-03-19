import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/response.js';
import { getAuthUser } from '../../middleware/auth.js';
import { updateProfileBodySchema } from './profile.schema.js';
import * as profileService from './profile.service.js';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const profile = await profileService.getProfile(getAuthUser(req).userId);
  sendSuccess({ res, message: 'Profile retrieved', data: profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body = updateProfileBodySchema.parse(req.body);
  const profile = await profileService.updateProfile(getAuthUser(req).userId, body);
  sendSuccess({ res, message: 'Profile updated', data: profile });
}
