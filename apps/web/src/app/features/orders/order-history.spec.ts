import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { OrderHistoryPage } from './order-history';

describe('OrderHistoryPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderHistoryPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(OrderHistoryPage);
    fixture.detectChanges();

    // Flush the HTTP request triggered by ngOnInit
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows empty state when no orders', () => {
    const fixture = TestBed.createComponent(OrderHistoryPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No orders found');
  });

  it('renders order list', () => {
    const fixture = TestBed.createComponent(OrderHistoryPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [
        { id: 1, orderNumber: 'PCH-20240101-AAAA', status: 'PENDING', paymentMethod: 'COD', totalAmount: 21900, itemCount: 2, createdAt: '2024-01-01T00:00:00Z' },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('PCH-20240101-AAAA');
    expect(el.textContent).toContain('2 items');
  });
});
