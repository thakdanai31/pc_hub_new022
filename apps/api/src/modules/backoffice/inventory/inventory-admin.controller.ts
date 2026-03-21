import type { Request, Response } from 'express';
import { sendSuccess } from '../../../common/response.js';
import { sendPaginatedSuccess } from '../../../common/pagination.js';
import { getAuthUser } from '../../../middleware/auth.js';
import {
  currentInventoryListQuerySchema,
  inventoryReconciliationBackfillBodySchema,
  inventoryReconciliationReportQuerySchema,
  inventoryMutationBodySchema,
  inventoryTransactionListQuerySchema,
  productIdParamSchema,
  productInventoryTransactionListQuerySchema,
} from '../../inventory/inventory.schema.js';
import * as inventoryService from '../../inventory/inventory.service.js';
import * as inventoryReconciliationService from '../../inventory/inventory-reconciliation.service.js';

export async function listCurrentInventory(req: Request, res: Response): Promise<void> {
  const query = currentInventoryListQuerySchema.parse(req.query);
  const result = await inventoryService.getCurrentInventoryOverview(query);

  sendPaginatedSuccess({
    res,
    message: 'Current inventory overview retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  const query = inventoryTransactionListQuerySchema.parse(req.query);
  const result = await inventoryService.getInventoryTransactions(query);

  sendPaginatedSuccess({
    res,
    message: 'Inventory transactions retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function listProductTransactions(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const query = productInventoryTransactionListQuerySchema.parse(req.query);
  const result = await inventoryService.getInventoryTransactionsByProduct(
    productId,
    query,
  );

  sendPaginatedSuccess({
    res,
    message: 'Product inventory transactions retrieved',
    data: result.data,
    pagination: result.pagination,
  });
}

export async function restockProduct(req: Request, res: Response): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const body = inventoryMutationBodySchema.parse(req.body);
  const result = await inventoryService.restockProduct(
    productId,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Product restocked',
    data: result,
    statusCode: 201,
  });
}

export async function adjustInventoryIn(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const body = inventoryMutationBodySchema.parse(req.body);
  const result = await inventoryService.adjustInventoryIn(
    productId,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Inventory adjusted in',
    data: result,
    statusCode: 201,
  });
}

export async function adjustInventoryOut(
  req: Request,
  res: Response,
): Promise<void> {
  const { productId } = productIdParamSchema.parse(req.params);
  const body = inventoryMutationBodySchema.parse(req.body);
  const result = await inventoryService.adjustInventoryOut(
    productId,
    body,
    getAuthUser(req).userId,
  );

  sendSuccess({
    res,
    message: 'Inventory adjusted out',
    data: result,
    statusCode: 201,
  });
}

export async function getReconciliationReport(
  req: Request,
  res: Response,
): Promise<void> {
  const query = inventoryReconciliationReportQuerySchema.parse(req.query);
  const result =
    await inventoryReconciliationService.getInventoryReconciliationReport(query);

  sendSuccess({
    res,
    message: 'Inventory reconciliation report retrieved',
    data: {
      rows: result.data,
      pagination: result.pagination,
      summary: result.summary,
    },
  });
}

export async function runReconciliationBackfill(
  req: Request,
  res: Response,
): Promise<void> {
  const body = inventoryReconciliationBackfillBodySchema.parse(req.body);
  const result =
    await inventoryReconciliationService.runInventoryReconciliationBackfill(
      body,
      getAuthUser(req).userId,
    );

  sendSuccess({
    res,
    message: body.dryRun
      ? 'Inventory reconciliation dry run completed'
      : 'Inventory reconciliation backfill completed',
    data: result,
  });
}
