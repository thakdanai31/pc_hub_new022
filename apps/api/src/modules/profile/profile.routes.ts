import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as profileController from './profile.controller.js';

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get('/', profileController.getProfile);
profileRouter.patch('/', profileController.updateProfile);
