import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ClaimHistoryPage } from './claim-history';

describe('ClaimHistoryPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClaimHistoryPage],
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

  it('renders customer claims', () => {
    const fixture = TestBed.createComponent(ClaimHistoryPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/account/claims') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [
        {
          id: 12,
          userId: 3,
          orderId: 5,
          productId: 8,
          issueDescription: 'The device powers off unexpectedly while gaming.',
          status: 'PENDING',
          adminNote: null,
          createdAt: '2026-03-10T10:00:00Z',
          updatedAt: '2026-03-10T10:00:00Z',
          order: {
            id: 5,
            orderNumber: 'PCH-20260310-AAAA',
            status: 'DELIVERED',
            createdAt: '2026-03-01T10:00:00Z',
          },
          product: {
            id: 8,
            name: 'RTX 4080 Super',
            slug: 'rtx-4080-super',
            sku: 'GPU-4080S',
          },
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('My Claims');
    expect(el.textContent).toContain('RTX 4080 Super');
    expect(el.textContent).toContain('PCH-20260310-AAAA');
    expect(el.textContent).toContain('Claim Request');
    expect(el.textContent).not.toContain('Claim #12');
  });
});
