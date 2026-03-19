import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as reportController from './report.controller.js';

export const reportRouter = Router();

reportRouter.use(requireRole('STAFF', 'ADMIN'));

reportRouter.get('/daily-sales', reportController.getDailySales);
reportRouter.get('/daily-sales/excel', reportController.exportDailySalesExcel);
reportRouter.get('/daily-sales/pdf', reportController.exportDailySalesPdf);
