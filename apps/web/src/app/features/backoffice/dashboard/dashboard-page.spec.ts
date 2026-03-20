import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardPage } from './dashboard-page';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { LANGUAGE_STORAGE_KEY } from '../../../core/i18n/translations';

function mockAuthService(role: 'STAFF' | 'ADMIN') {
  return {
    user: () => ({ id: 1, email: 'test@test.com', firstName: 'Test', lastName: 'User', role, isActive: true }),
    isAuthenticated: () => true,
    getAccessToken: () => 'token',
    logout: () => ({ subscribe: () => { /* noop */ } }),
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

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
    const pendingClaimsReq = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'PENDING',
    );
    const inReviewClaimsReq = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'IN_REVIEW',
    );
    const reconciliationReq = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/inventory/reconciliation') && r.params.get('limit') === '1',
    );
    const inventoryReq = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/inventory') && r.params.get('limit') === '5',
    );

    summaryReq.flush({
      success: true,
      data: { totalRevenue: 50000, totalOrders: 20, pendingReviewCount: 2, ordersByStatus: [], totalCustomers: 10, totalProducts: 50 },
    });
    trendReq.flush({ success: true, data: [] });
    topReq.flush({ success: true, data: [] });
    lowStockReq.flush({ success: true, data: [] });
    recentOrdersReq.flush({ success: true, data: [] });
    pendingClaimsReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 3, totalPages: 3 },
    });
    inReviewClaimsReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    reconciliationReq.flush({
      success: true,
      message: 'OK',
      data: {
        rows: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
        summary: {
          scannedOrders: 10,
          ordersWithIssues: 4,
          autoFixableOrders: 3,
          manualReviewOrders: 1,
          issueCounts: { MISSING_SALE_HISTORY: 2 },
        },
      },
    });
    inventoryReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });

    // Should NOT request daily sales
    httpTesting.expectNone((r) => r.url.includes('/backoffice/reports/daily-sales'));

    httpTesting.verify();
  });

  it('admin renders operational dashboard summaries from claims and reconciliation data', () => {
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

    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/summary')).flush({
      success: true,
      data: {
        totalRevenue: 50000,
        totalOrders: 20,
        pendingReviewCount: 2,
        ordersByStatus: [],
        totalCustomers: 10,
        totalProducts: 50,
      },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/revenue-trend')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/top-products')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/low-stock')).flush({
      success: true,
      data: [
        {
          id: 7,
          name: 'RTX 5070',
          sku: 'GPU-5070',
          stock: 2,
          price: 25990,
          categoryName: 'Graphics Cards',
          imageUrl: null,
        },
      ],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/recent-orders')).flush({
      success: true,
      data: [
        {
          id: 90,
          orderNumber: 'ORD-90',
          status: 'PENDING',
          totalAmount: 1234,
          itemCount: 1,
          createdAt: '2026-03-19T00:00:00.000Z',
          customerName: 'Test User',
        },
      ],
    });
    httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'PENDING',
    ).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 3, totalPages: 3 },
    });
    httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'IN_REVIEW',
    ).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/inventory/reconciliation')).flush({
      success: true,
      message: 'OK',
      data: {
        rows: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
        summary: {
          scannedOrders: 10,
          ordersWithIssues: 4,
          autoFixableOrders: 3,
          manualReviewOrders: 1,
          issueCounts: { MISSING_SALE_HISTORY: 2 },
        },
      },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/inventory') && !r.url.includes('/reconciliation')).flush({
      success: true,
      message: 'OK',
      data: [
        {
          id: 1,
          productId: 7,
          type: 'RESTOCK',
          quantity: 5,
          referenceId: null,
          note: 'Supplier restock',
          createdAt: '2026-03-19T00:00:00.000Z',
          product: {
            id: 7,
            name: 'RTX 5070',
            slug: 'rtx-5070',
            sku: 'GPU-5070',
          },
        },
      ],
      pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Claims To Review');
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('Reconciliation Findings');
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('Recent Inventory Activity');
    expect(el.textContent).toContain('RTX 5070');
    expect(el.textContent).toContain('Restock');
  });

  it('renders translated Thai dashboard labels when the saved language is Thai', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'th');

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
    const language = TestBed.inject(LanguageService);
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/summary')).flush({
      success: true,
      data: {
        totalRevenue: 50000,
        totalOrders: 20,
        pendingReviewCount: 2,
        ordersByStatus: [],
        totalCustomers: 10,
        totalProducts: 50,
      },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/revenue-trend')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/top-products')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/low-stock')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/recent-orders')).flush({
      success: true,
      data: [],
    });
    httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'PENDING',
    ).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/claims') && r.params.get('status') === 'IN_REVIEW',
    ).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/inventory/reconciliation')).flush({
      success: true,
      message: 'OK',
      data: {
        rows: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
        summary: {
          scannedOrders: 10,
          ordersWithIssues: 2,
          autoFixableOrders: 1,
          manualReviewOrders: 1,
          issueCounts: { MISSING_SALE_HISTORY: 1 },
        },
      },
    });
    httpTesting.expectOne((r) => r.url.includes('/backoffice/inventory') && !r.url.includes('/reconciliation')).flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(language.translate('backoffice.dashboard.claimsToReview'));
    expect(el.textContent).toContain(language.translate('backoffice.dashboard.reconciliationFindings'));
  });
});
