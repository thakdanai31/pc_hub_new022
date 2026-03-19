import type { Response } from 'express';

interface SuccessResponseOptions<T> {
  res: Response;
  message: string;
  data?: T;
  statusCode?: number;
}

export function sendSuccess<T>({
  res,
  message,
  data,
  statusCode = 200,
}: SuccessResponseOptions<T>): void {
  res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
  });
}

interface ErrorResponseOptions {
  res: Response;
  message: string;
  code: string;
  statusCode?: number;
}

export function sendError({
  res,
  message,
  code,
  statusCode = 500,
}: ErrorResponseOptions): void {
  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}
