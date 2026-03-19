import type { Response } from 'express';
import { z } from 'zod/v4';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

interface PaginatedResponseOptions<T> {
  res: Response;
  message: string;
  data: T[];
  pagination: PaginationMeta;
  statusCode?: number;
}

export function sendPaginatedSuccess<T>({
  res,
  message,
  data,
  pagination,
  statusCode = 200,
}: PaginatedResponseOptions<T>): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
}
