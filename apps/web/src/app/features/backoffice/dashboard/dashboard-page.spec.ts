import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard-page';
import { AuthService } from '../../../core/services/auth.service';

function mockAuthService(role: 'STAFF' | 'ADMIN') {
  return {
    user: () => ({ id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User', role, isActive: true }),
    isAuthenticated: () => true,
    getAccessToken: () => 'token',
    logout: () => ({ subscribe: () => { /* noop */ } }),
  };
}

describe('DashboardPage', () => {
  it('staff fetches daily sales and not analytics', () => {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService('STAFF') },
      ],
    });

    const httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    // Staff should request daily sales
    const salesReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/reports/daily-sales'));
    expect(salesReq.request.method).toBe('GET');
    salesReq.flush({
      success: true,
      data: { date: '2026-03-15', totalOrders: 3, completedRevenue: 1000, pendingRevenue: 500, ordersByStatus: [], ordersByPaymentMethod: [], items: [] },
    });

    // Should NOT request analytics
    httpTesting.expectNone((r) => r.url.includes('/backoffice/analytics'));

    httpTesting.verify();
  });

  it('admin fetches analytics, revenue trend, and top products', () => {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService('ADMIN') },
      ],
    });

    const httpTesting = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    // Admin should request all 5 analytics endpoints via forkJoin
    const summaryReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/summary'));
    const trendReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/revenue-trend'));
    const topReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/top-products'));
    const lowStockReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/low-stock'));
    const recentOrdersReq = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/recent-orders'));

    summaryReq.flush({
      success: true,
      data: { totalRevenue: 50000, totalOrders: 20, pendingReviewCount: 2, ordersByStatus: [], totalCustomers: 10, totalProducts: 50 },
    });
    trendReq.flush({ success: true, data: [] });
    topReq.flush({ success: true, data: [] });
    lowStockReq.flush({ success: true, data: [] });
    recentOrdersReq.flush({ success: true, data: [] });

    // Should NOT request daily sales
    httpTesting.expectNone((r) => r.url.includes('/backoffice/reports/daily-sales'));

    httpTesting.verify();
  });
});
