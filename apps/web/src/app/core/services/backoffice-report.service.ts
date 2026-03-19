import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';

export interface DailySalesItem {
  orderId: number;
  orderNumber: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface PaymentMethodCount {
  paymentMethod: string;
  count: number;
}

export interface DailySalesResult {
  date: string;
  totalOrders: number;
  completedRevenue: number;
  pendingRevenue: number;
  ordersByStatus: StatusCount[];
  ordersByPaymentMethod: PaymentMethodCount[];
  items: DailySalesItem[];
}

@Injectable({ providedIn: 'root' })
export class BackofficeReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getDailySales(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;

    return this.http.get<ApiResponse<DailySalesResult>>(
      `${this.apiUrl}/backoffice/reports/daily-sales`,
      { params },
    );
  }

  downloadExcel(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;

    return this.http.get(
      `${this.apiUrl}/backoffice/reports/daily-sales/excel`,
      { params, responseType: 'blob' },
    );
  }

  downloadPdf(date?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;

    return this.http.get(
      `${this.apiUrl}/backoffice/reports/daily-sales/pdf`,
      { params, responseType: 'blob' },
    );
  }
}
