import type { Request, Response } from 'express';
import { sendError } from '../common/response.js';

export function notFoundHandler(_req: Request, res: Response): void {
  sendError({
    res,
    message: 'Route not found',
    code: 'NOT_FOUND',
    statusCode: 404,
  });
}
