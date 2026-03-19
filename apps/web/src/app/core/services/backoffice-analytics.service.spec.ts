import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BackofficeAnalyticsService } from './backoffice-analytics.service';

describe('BackofficeAnalyticsService', () => {
  let service: BackofficeAnalyticsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BackofficeAnalyticsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches analytics summary', () => {
    service.getSummary().subscribe((res) => {
      expect(res.data.totalOrders).toBe(5);
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/backoffice/analytics/summary'));
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { totalRevenue: 1000, totalOrders: 5, pendingReviewCount: 1, ordersByStatus: [], totalCustomers: 3, totalProducts: 10 },
    });
  });

  it('fetches revenue trend with period param', () => {
    service.getRevenueTrend('7d').subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/analytics/revenue-trend') && r.params.get('period') === '7d',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [{ date: '2026-03-15', revenue: 100, orderCount: 1 }] });
  });

  it('fetches top products with limit param', () => {
    service.getTopProducts(5).subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/analytics/top-products') && r.params.get('limit') === '5',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [{ productId: 1, productName: 'RTX 4090', sku: 'GPU-4090', totalQuantitySold: 10, totalRevenue: 59900 }],
    });
  });
});
