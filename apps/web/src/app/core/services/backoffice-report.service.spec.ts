import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BackofficeReportService } from './backoffice-report.service';

describe('BackofficeReportService', () => {
  let service: BackofficeReportService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BackofficeReportService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches daily sales without date param', () => {
    service.getDailySales().subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/reports/daily-sales') && !r.params.has('date'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { date: '2026-03-15', totalOrders: 0, completedRevenue: 0, pendingRevenue: 0, ordersByStatus: [], ordersByPaymentMethod: [], items: [] } });
  });

  it('fetches daily sales with date param', () => {
    service.getDailySales('2026-01-01').subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/backoffice/reports/daily-sales') && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { date: '2026-01-01', totalOrders: 0, completedRevenue: 0, pendingRevenue: 0, ordersByStatus: [], ordersByPaymentMethod: [], items: [] } });
  });

  it('downloads Excel as blob', () => {
    service.downloadExcel('2026-01-01').subscribe((blob) => {
      expect(blob).toBeInstanceOf(Blob);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/daily-sales/excel') && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  });

  it('downloads PDF as blob', () => {
    service.downloadPdf('2026-01-01').subscribe((blob) => {
      expect(blob).toBeInstanceOf(Blob);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/daily-sales/pdf') && r.params.get('date') === '2026-01-01',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['test'], { type: 'application/pdf' }));
  });
});
