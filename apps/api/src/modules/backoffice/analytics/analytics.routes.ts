import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as analyticsController from './analytics.controller.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireRole('ADMIN'));

analyticsRouter.get('/summary', analyticsController.getSummary);
analyticsRouter.get('/revenue-trend', analyticsController.getRevenueTrend);
analyticsRouter.get('/top-products', analyticsController.getTopProducts);
analyticsRouter.get('/low-stock', analyticsController.getLowStockProducts);
analyticsRouter.get('/recent-orders', analyticsController.getRecentOrders);
