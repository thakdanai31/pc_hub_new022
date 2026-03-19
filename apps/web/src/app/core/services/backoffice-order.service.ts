import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';

export interface BackofficeOrderSummary {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  customer: { id: number; firstName: string; lastName: string; email: string };
  paymentStatus: string | null;
}

export interface BackofficeOrderDetail {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  addressSnapshot: Record<string, string>;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  customerNote: string | null;
  approvedByUserId: number | null;
  approvedAt: string | null;
  rejectedByUserId: number | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  customer: { id: number; firstName: string; lastName: string; email: string; phoneNumber: string };
  items: {
    id: number;
    productId: number;
    productSnapshot: Record<string, unknown>;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  payment: {
    id: number;
    paymentMethod: string;
    status: string;
    amount: number;
    rejectReason: string | null;
    reviewedAt: string | null;
    reviewedByUserId: number | null;
    slips: { id: number; imageUrl: string; uploadedAt: string }[];
  } | null;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable({ providedIn: 'root' })
export class BackofficeOrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listOrders(params: OrderListParams = {}) {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.status) queryParams['status'] = params.status;
    if (params.paymentMethod) queryParams['paymentMethod'] = params.paymentMethod;
    if (params.search) queryParams['search'] = params.search;
    if (params.dateFrom) queryParams['dateFrom'] = params.dateFrom;
    if (params.dateTo) queryParams['dateTo'] = params.dateTo;

    return this.http.get<PaginatedApiResponse<BackofficeOrderSummary>>(
      `${this.apiUrl}/backoffice/orders`,
      { params: queryParams },
    );
  }

  getOrder(orderId: number) {
    return this.http.get<ApiResponse<BackofficeOrderDetail>>(
      `${this.apiUrl}/backoffice/orders/${orderId}`,
    );
  }

  approveOrder(orderId: number) {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.apiUrl}/backoffice/orders/${orderId}/approve`,
      {},
    );
  }

  rejectOrder(orderId: number, reason: string) {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.apiUrl}/backoffice/orders/${orderId}/reject`,
      { reason },
    );
  }

  advanceStatus(orderId: number, status: string) {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.apiUrl}/backoffice/orders/${orderId}/status`,
      { status },
    );
  }
}
