import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';
import type {
  OrderSummary,
  OrderDetail,
  PaymentInfo,
  PromptPayQR,
  SlipUploadResult,
} from '../../shared/models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getOrders(page = 1, limit = 10, status?: string) {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (status) params['status'] = status;

    return this.http.get<PaginatedApiResponse<OrderSummary>>(
      `${this.apiUrl}/account/orders`,
      { params },
    );
  }

  getOrder(orderId: number) {
    return this.http.get<ApiResponse<OrderDetail>>(
      `${this.apiUrl}/account/orders/${orderId}`,
    );
  }

  getPayment(orderId: number) {
    return this.http.get<ApiResponse<PaymentInfo>>(
      `${this.apiUrl}/account/orders/${orderId}/payment`,
    );
  }

  getPromptPayQR(orderId: number) {
    return this.http.get<ApiResponse<PromptPayQR>>(
      `${this.apiUrl}/account/orders/${orderId}/promptpay`,
    );
  }

  uploadSlip(orderId: number, file: File) {
    const formData = new FormData();
    formData.append('slip', file);
    return this.http.post<ApiResponse<SlipUploadResult>>(
      `${this.apiUrl}/account/orders/${orderId}/payment-slip`,
      formData,
    );
  }
}
