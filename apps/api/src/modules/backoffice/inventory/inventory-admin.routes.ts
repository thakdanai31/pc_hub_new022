import { Router } from 'express';
import { requireRole } from '../../../middleware/role.js';
import * as inventoryAdminController from './inventory-admin.controller.js';

export const inventoryAdminRouter = Router();

inventoryAdminRouter.use(requireRole('STAFF', 'ADMIN'));

inventoryAdminRouter.get('/', inventoryAdminController.listTransactions);
inventoryAdminRouter.get(
  '/reconciliation',
  requireRole('ADMIN'),
  inventoryAdminController.getReconciliationReport,
);
inventoryAdminRouter.post(
  '/reconciliation/backfill',
  requireRole('ADMIN'),
  inventoryAdminController.runReconciliationBackfill,
);
inventoryAdminRouter.get(
  '/products/:productId/transactions',
  inventoryAdminController.listProductTransactions,
);
inventoryAdminRouter.post(
  '/products/:productId/restock',
  inventoryAdminController.restockProduct,
);
inventoryAdminRouter.post(
  '/products/:productId/adjust-in',
  inventoryAdminController.adjustInventoryIn,
);
inventoryAdminRouter.post(
  '/products/:productId/adjust-out',
  inventoryAdminController.adjustInventoryOut,
);
