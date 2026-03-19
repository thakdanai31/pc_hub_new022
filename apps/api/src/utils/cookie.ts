import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.JWT_REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

export function getRefreshCookieName(): string {
  return REFRESH_COOKIE_NAME;
}
