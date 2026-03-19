import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { revenueTrendQuerySchema, topProductsQuerySchema, lowStockQuerySchema, recentOrdersQuerySchema } from './analytics.schema.js';
import * as analyticsService from './analytics.service.js';

export async function getSummary(_req: Request, res: Response) {
  const result = await analyticsService.getSummary();
  sendSuccess({ res, message: 'Analytics summary retrieved', data: result });
}

export async function getRevenueTrend(req: Request, res: Response) {
  const { period } = revenueTrendQuerySchema.parse(req.query);
  const result = await analyticsService.getRevenueTrend(period);
  sendSuccess({ res, message: 'Revenue trend retrieved', data: result });
}

export async function getTopProducts(req: Request, res: Response) {
  const { limit } = topProductsQuerySchema.parse(req.query);
  const result = await analyticsService.getTopProducts(limit);
  sendSuccess({ res, message: 'Top products retrieved', data: result });
}

export async function getLowStockProducts(req: Request, res: Response) {
  const { threshold, limit } = lowStockQuerySchema.parse(req.query);
  const result = await analyticsService.getLowStockProducts(threshold, limit);
  sendSuccess({ res, message: 'Low stock products retrieved', data: result });
}

export async function getRecentOrders(req: Request, res: Response) {
  const { limit } = recentOrdersQuerySchema.parse(req.query);
  const result = await analyticsService.getRecentOrders(limit);
  sendSuccess({ res, message: 'Recent orders retrieved', data: result });
}
