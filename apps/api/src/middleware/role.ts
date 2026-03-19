import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../common/response.js';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError({
        res,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError({
        res,
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        statusCode: 403,
      });
      return;
    }

    next();
  };
}
