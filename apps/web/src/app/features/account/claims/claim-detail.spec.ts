import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { ClaimDetailPage } from './claim-detail';

describe('ClaimDetailPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClaimDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ claimId: '12' }),
            },
          },
        },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders claim details for the customer', () => {
    const fixture = TestBed.createComponent(ClaimDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/account/claims/12') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 12,
        userId: 3,
        orderId: 5,
        productId: 8,
        issueDescription: 'The device powers off unexpectedly while gaming.',
        status: 'IN_REVIEW',
        adminNote: 'We are checking the hardware logs.',
        createdAt: '2026-03-10T10:00:00Z',
        updatedAt: '2026-03-11T09:30:00Z',
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
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Claim Details');
    expect(el.textContent).not.toContain('Claim #12');
    expect(el.textContent).toContain('RTX 4080 Super');
    expect(el.textContent).toContain('We are checking the hardware logs.');
  });
});
