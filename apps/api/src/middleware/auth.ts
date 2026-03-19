import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.js';
import type { AccessTokenPayload } from '../utils/token.js';
import { sendError } from '../common/response.js';
import { AppError } from '../common/errors.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice(7);
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    sendError({
      res,
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    sendError({
      res,
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }
}

/**
 * Returns the authenticated user from the request.
 * Throws 401 if the user is not set (should only be called after requireAuth).
 */
export function getAuthUser(req: Request): AccessTokenPayload {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  return req.user;
}

export function extractUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // Best-effort extraction — do not reject
    }
  }
  next();
}
