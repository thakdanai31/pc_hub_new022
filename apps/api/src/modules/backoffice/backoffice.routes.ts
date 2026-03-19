import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { categoryAdminRouter } from './categories/category-admin.routes.js';
import { brandAdminRouter } from './brands/brand-admin.routes.js';
import { productAdminRouter } from './products/product-admin.routes.js';
import { orderAdminRouter } from './orders/order-admin.routes.js';
import { reportRouter } from './reports/report.routes.js';
import { analyticsRouter } from './analytics/analytics.routes.js';
import { userAdminRouter } from './users/user-admin.routes.js';

export const backofficeRouter = Router();

// All backoffice routes require authentication
backofficeRouter.use(requireAuth);

backofficeRouter.use('/categories', categoryAdminRouter);
backofficeRouter.use('/brands', brandAdminRouter);
backofficeRouter.use('/products', productAdminRouter);
backofficeRouter.use('/orders', orderAdminRouter);
backofficeRouter.use('/reports', reportRouter);
backofficeRouter.use('/analytics', analyticsRouter);
backofficeRouter.use('/users', userAdminRouter);
