import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { ClaimCreatePage } from './claim-create';

describe('ClaimCreatePage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClaimCreatePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                orderId: '1',
                productId: '1',
              }),
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

  it('submits a claim for a delivered order item', () => {
    const fixture = TestBed.createComponent(ClaimCreatePage);
    fixture.detectChanges();

    const orderReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/account/orders/1') &&
        r.method === 'GET' &&
        !r.url.includes('payment') &&
        !r.url.includes('promptpay'),
    );
    orderReq.flush({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        orderNumber: 'PCH-20260310-AAAA',
        status: 'DELIVERED',
        paymentMethod: 'COD',
        addressSnapshot: {
          recipientName: 'Customer User',
          phoneNumber: '0800000000',
          line1: '123 St',
          district: 'D',
          subdistrict: 'S',
          province: 'Bangkok',
          postalCode: '10100',
        },
        subtotalAmount: 21900,
        shippingAmount: 0,
        totalAmount: 21900,
        customerNote: null,
        approvedAt: null,
        rejectedAt: null,
        rejectReason: null,
        createdAt: '2026-03-01T10:00:00Z',
        items: [
          {
            id: 10,
            productId: 1,
            productSnapshot: {
              name: 'Ryzen 9',
              sku: 'CPU-R9',
              warrantyMonths: 36,
              categoryName: 'CPUs',
              brandName: 'AMD',
              image: null,
            },
            quantity: 1,
            unitPrice: 21900,
            lineTotal: 21900,
          },
        ],
        payment: null,
      },
    });
    fixture.detectChanges();

    fixture.componentInstance.issueDescription = 'The processor is overheating during normal use.';
    fixture.componentInstance.submitClaim();

    const claimReq = httpTesting.expectOne(
      (r) => r.url.includes('/account/claims') && r.method === 'POST',
    );
    expect(claimReq.request.body).toEqual({
      orderId: 1,
      productId: 1,
      issueDescription: 'The processor is overheating during normal use.',
    });
    claimReq.flush({
      success: true,
      message: 'Claim created',
      data: {
        id: 41,
        userId: 3,
        orderId: 1,
        productId: 1,
        issueDescription: 'The processor is overheating during normal use.',
        status: 'PENDING',
        adminNote: null,
        createdAt: '2026-03-19T08:00:00Z',
        updatedAt: '2026-03-19T08:00:00Z',
        order: {
          id: 1,
          orderNumber: 'PCH-20260310-AAAA',
          status: 'DELIVERED',
          createdAt: '2026-03-01T10:00:00Z',
        },
        product: {
          id: 1,
          name: 'Ryzen 9',
          slug: 'ryzen-9',
          sku: 'CPU-R9',
        },
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Your claim has been submitted successfully.');
    expect(el.textContent).toContain('Claim Request Submitted');
    expect(el.textContent).not.toContain('Claim #41');
    expect(el.textContent).toContain('View Claim Details');
  });
});
