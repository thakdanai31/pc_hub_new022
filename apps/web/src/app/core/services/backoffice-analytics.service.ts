import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';

export interface StatusCount {
  status: string;
  count: number;
}

export interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  pendingReviewCount: number;
  ordersByStatus: StatusCount[];
  totalCustomers: number;
  totalProducts: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface TopProduct {
  productId: number;
  productName: string;
  sku: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
  categoryName: string;
  imageUrl: string | null;
}

export interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  customerName: string;
}

@Injectable({ providedIn: 'root' })
export class BackofficeAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getSummary() {
    return this.http.get<ApiResponse<AnalyticsSummary>>(
      `${this.apiUrl}/backoffice/analytics/summary`,
    );
  }

  getRevenueTrend(period: '7d' | '30d' | '90d' = '30d') {
    return this.http.get<ApiResponse<RevenueTrendPoint[]>>(
      `${this.apiUrl}/backoffice/analytics/revenue-trend`,
      { params: { period } },
    );
  }

  getTopProducts(limit = 10) {
    return this.http.get<ApiResponse<TopProduct[]>>(
      `${this.apiUrl}/backoffice/analytics/top-products`,
      { params: { limit: String(limit) } },
    );
  }

  getLowStockProducts(threshold = 10, limit = 5) {
    return this.http.get<ApiResponse<LowStockProduct[]>>(
      `${this.apiUrl}/backoffice/analytics/low-stock`,
      { params: { threshold: String(threshold), limit: String(limit) } },
    );
  }

  getRecentOrders(limit = 5) {
    return this.http.get<ApiResponse<RecentOrder[]>>(
      `${this.apiUrl}/backoffice/analytics/recent-orders`,
      { params: { limit: String(limit) } },
    );
  }
}
