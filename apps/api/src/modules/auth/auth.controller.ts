import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import { registerBodySchema, loginBodySchema } from './auth.schema.js';
import { sendSuccess } from '../../common/response.js';
import { setRefreshCookie, clearRefreshCookie, getRefreshCookieName } from '../../utils/cookie.js';
import { getAuthUser } from '../../middleware/auth.js';

function getCookieValue(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === 'string' ? value : undefined;
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerBodySchema.parse(req.body);
  const result = await authService.register(body);

  setRefreshCookie(res, result.tokens.refreshToken);

  sendSuccess({
    res,
    message: 'Registration successful',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
    statusCode: 201,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginBodySchema.parse(req.body);
  const result = await authService.login(body);

  setRefreshCookie(res, result.tokens.refreshToken);

  sendSuccess({
    res,
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.tokens.accessToken,
    },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const cookieName = getRefreshCookieName();
  const rawToken = getCookieValue(req, cookieName);

  if (!rawToken) {
    clearRefreshCookie(res);
    res.status(401).json({
      success: false,
      message: 'Refresh token required',
      code: 'MISSING_REFRESH_TOKEN',
    });
    return;
  }

  const result = await authService.refresh(rawToken);

  setRefreshCookie(res, result.refreshToken);

  sendSuccess({
    res,
    message: 'Token refreshed',
    data: { accessToken: result.accessToken },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const cookieName = getRefreshCookieName();
  const rawToken = getCookieValue(req, cookieName);

  if (rawToken) {
    await authService.logout(rawToken);
  }

  clearRefreshCookie(res);

  sendSuccess({ res, message: 'Logged out successfully' });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.me(getAuthUser(req).userId);

  sendSuccess({
    res,
    message: 'Current user',
    data: user,
  });
}
