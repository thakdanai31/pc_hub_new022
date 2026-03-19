import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, extractUser } from '../../middleware/auth.js';
import { registerBodySchema, loginBodySchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate({ body: registerBodySchema }),
  authController.register,
);

authRouter.post(
  '/login',
  validate({ body: loginBodySchema }),
  authController.login,
);

authRouter.post('/refresh', authController.refresh);

authRouter.post('/logout', extractUser, authController.logout);

authRouter.get('/me', requireAuth, authController.me);
