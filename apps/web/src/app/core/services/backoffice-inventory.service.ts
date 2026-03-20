import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';

export type InventoryTransactionType =
  | 'RESTOCK'
  | 'SALE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT';

export type InventoryReconciliationOrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'PAYMENT_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type InventoryReconciliationIssueCode =
  | 'MISSING_SALE_HISTORY'
  | 'MISSING_RETURN_HISTORY'
  | 'DUPLICATE_SALE_HISTORY'
  | 'DUPLICATE_RETURN_HISTORY'
  | 'UNEXPECTED_SALE_HISTORY'
  | 'UNEXPECTED_RETURN_HISTORY'
  | 'SALE_QUANTITY_MISMATCH'
  | 'RETURN_QUANTITY_MISMATCH'
  | 'AMBIGUOUS_CANCELLED_ORDER';

export type InventoryReconciliationAction =
  | 'BACKFILL_SALE_HISTORY'
  | 'BACKFILL_RETURN_HISTORY';

export type InventoryReconciliationState =
  | 'COMMITTED'
  | 'COMMITTED_CANCELLED'
  | 'NOT_COMMITTED'
  | 'AMBIGUOUS_CANCELLED';

export type InventoryReconciliationResultStatus =
  | 'planned'
  | 'applied'
  | 'skipped'
  | 'failed';

export interface InventoryTransactionRecord {
  id: number;
  productId: number;
  type: InventoryTransactionType;
  quantity: number;
  referenceId: number | null;
  note: string | null;
  createdAt: string;
  product: {
    id: number;
    name: string;
    slug: string;
    sku: string;
  };
}

export interface InventoryTransactionListParams {
  page?: number;
  limit?: number;
  productId?: number;
  type?: InventoryTransactionType;
  referenceId?: number;
}

export interface InventoryMutationBody {
  quantity: number;
  referenceId?: number;
  note?: string;
}

export interface InventoryMutationResult {
  product: {
    id: number;
    name: string;
    slug: string;
    sku: string;
    stock: number;
  };
  transaction: InventoryTransactionRecord;
  previousStock: number;
}

export interface InventoryReconciliationIssue {
  code: InventoryReconciliationIssueCode;
  message: string;
  autoFixable: boolean;
}

export interface InventoryReconciliationOrderRow {
  orderId: number;
  orderNumber: string;
  status: InventoryReconciliationOrderStatus;
  paymentMethod: 'COD' | 'PROMPTPAY_QR';
  createdAt: string;
  reconciliationState: InventoryReconciliationState;
  commitEvidence: string[];
  expectedSaleQuantity: number;
  actualSaleQuantity: number;
  expectedReturnQuantity: number;
  actualReturnQuantity: number;
  expectedNetMovement: number;
  actualNetMovement: number;
  netMovementGap: number;
  issues: InventoryReconciliationIssue[];
  suggestedActions: InventoryReconciliationAction[];
  autoFixable: boolean;
  manualReviewRequired: boolean;
  stockReviewRecommended: boolean;
}

export interface InventoryReconciliationReportSummary {
  scannedOrders: number;
  ordersWithIssues: number;
  autoFixableOrders: number;
  manualReviewOrders: number;
  issueCounts: Record<string, number>;
}

export interface InventoryReconciliationReportPayload {
  rows: InventoryReconciliationOrderRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: InventoryReconciliationReportSummary;
}

export interface InventoryReconciliationReportParams {
  page?: number;
  limit?: number;
  orderId?: number;
  status?: InventoryReconciliationOrderStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface InventoryReconciliationBackfillResult {
  orderId: number;
  orderNumber: string | null;
  status: InventoryReconciliationResultStatus;
  plannedActions: InventoryReconciliationAction[];
  appliedActions: InventoryReconciliationAction[];
  issues: InventoryReconciliationIssue[];
  manualReviewRequired: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface InventoryReconciliationBackfillPayload {
  dryRun: boolean;
  results: InventoryReconciliationBackfillResult[];
  summary: {
    requestedOrders: number;
    plannedOrders: number;
    appliedOrders: number;
    skippedOrders: number;
    failedOrders: number;
  };
}

@Injectable({ providedIn: 'root' })
export class BackofficeInventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listTransactions(params: InventoryTransactionListParams = {}) {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.productId) queryParams['productId'] = String(params.productId);
    if (params.type) queryParams['type'] = params.type;
    if (params.referenceId) {
      queryParams['referenceId'] = String(params.referenceId);
    }

    return this.http.get<PaginatedApiResponse<InventoryTransactionRecord>>(
      `${this.apiUrl}/backoffice/inventory`,
      { params: queryParams },
    );
  }

  getProductTransactions(
    productId: number,
    params: Omit<InventoryTransactionListParams, 'productId'> = {},
  ) {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.type) queryParams['type'] = params.type;
    if (params.referenceId) {
      queryParams['referenceId'] = String(params.referenceId);
    }

    return this.http.get<PaginatedApiResponse<InventoryTransactionRecord>>(
      `${this.apiUrl}/backoffice/inventory/products/${productId}/transactions`,
      { params: queryParams },
    );
  }

  restockProduct(productId: number, body: InventoryMutationBody) {
    return this.http.post<ApiResponse<InventoryMutationResult>>(
      `${this.apiUrl}/backoffice/inventory/products/${productId}/restock`,
      body,
    );
  }

  adjustInventoryIn(productId: number, body: InventoryMutationBody) {
    return this.http.post<ApiResponse<InventoryMutationResult>>(
      `${this.apiUrl}/backoffice/inventory/products/${productId}/adjust-in`,
      body,
    );
  }

  adjustInventoryOut(productId: number, body: InventoryMutationBody) {
    return this.http.post<ApiResponse<InventoryMutationResult>>(
      `${this.apiUrl}/backoffice/inventory/products/${productId}/adjust-out`,
      body,
    );
  }

  getReconciliationReport(
    params: InventoryReconciliationReportParams = {},
  ) {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.orderId) queryParams['orderId'] = String(params.orderId);
    if (params.status) queryParams['status'] = params.status;
    if (params.dateFrom) queryParams['dateFrom'] = params.dateFrom;
    if (params.dateTo) queryParams['dateTo'] = params.dateTo;

    return this.http.get<ApiResponse<InventoryReconciliationReportPayload>>(
      `${this.apiUrl}/backoffice/inventory/reconciliation`,
      { params: queryParams },
    );
  }

  runReconciliationBackfill(orderIds: number[], dryRun = true) {
    return this.http.post<ApiResponse<InventoryReconciliationBackfillPayload>>(
      `${this.apiUrl}/backoffice/inventory/reconciliation/backfill`,
      { orderIds, dryRun },
    );
  }
}
