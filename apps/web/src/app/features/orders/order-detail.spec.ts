import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { OrderDetailPage } from './order-detail';

const MOCK_ORDER = {
  id: 1,
  orderNumber: 'PCH-20240101-AAAA',
  status: 'PENDING',
  paymentMethod: 'COD',
  addressSnapshot: { recipientName: 'Test User', phoneNumber: '0800000000', line1: '123 St', district: 'D', subdistrict: 'S', province: 'Bangkok', postalCode: '10100' },
  subtotalAmount: 21900,
  shippingAmount: 0,
  totalAmount: 21900,
  customerNote: null,
  approvedAt: null,
  rejectedAt: null,
  rejectReason: null,
  createdAt: '2024-01-01T00:00:00Z',
  items: [
    {
      id: 10,
      productId: 1,
      productSnapshot: { name: 'Ryzen 9', sku: 'CPU-R9', warrantyMonths: 36, categoryName: 'CPUs', brandName: 'AMD', image: null },
      quantity: 1,
      unitPrice: 21900,
      lineTotal: 21900,
    },
  ],
  payment: { id: 1, paymentMethod: 'COD', status: 'UNPAID', amount: 21900, rejectReason: null, reviewedAt: null, slips: [] },
};

describe('OrderDetailPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { orderId: '1' } } },
        },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('creates the component and loads order', () => {
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1') && r.method === 'GET' && !r.url.includes('payment') && !r.url.includes('promptpay'),
    );
    req.flush({ success: true, message: 'OK', data: MOCK_ORDER });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('PCH-20240101-AAAA');
    expect(el.textContent).toContain('Ryzen 9');
  });

  it('shows QR section for PromptPay awaiting payment', () => {
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();

    const ppOrder = { ...MOCK_ORDER, paymentMethod: 'PROMPTPAY_QR', status: 'AWAITING_PAYMENT' };
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1') && r.method === 'GET' && !r.url.includes('payment') && !r.url.includes('promptpay'),
    );
    req.flush({ success: true, message: 'OK', data: ppOrder });
    fixture.detectChanges();

    // QR endpoint should be called
    const qrReq = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1/promptpay') && r.method === 'GET',
    );
    qrReq.flush({
      success: true,
      message: 'OK',
      data: { qrDataUrl: 'data:image/png;base64,xxx', amount: 21900, promptPayId: '0812345678', orderNumber: 'PCH-20240101-AAAA' },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Complete Your Payment');
    expect(el.textContent).toContain('Upload Payment Slip');
  });

  it('shows rejection notice for rejected orders', () => {
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();

    const rejectedOrder = { ...MOCK_ORDER, status: 'REJECTED', rejectReason: 'Invalid slip' };
    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1') && r.method === 'GET' && !r.url.includes('payment') && !r.url.includes('promptpay'),
    );
    req.flush({ success: true, message: 'OK', data: rejectedOrder });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Order Rejected');
    expect(el.textContent).toContain('Invalid slip');
  });
});
