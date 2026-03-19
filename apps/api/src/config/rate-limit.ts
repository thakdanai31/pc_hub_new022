import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from './env.js';

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string;
}

/**
 * Creates a rate limiter that is automatically disabled in the test environment.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  if (env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: options.message ?? 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  });
}
