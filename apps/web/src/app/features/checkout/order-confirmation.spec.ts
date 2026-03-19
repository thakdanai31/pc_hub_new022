import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { OrderConfirmationPage } from './order-confirmation';

describe('OrderConfirmationPage', () => {
  let fixture: ComponentFixture<OrderConfirmationPage>;
  let httpTesting: HttpTestingController;

  function setup(queryParams: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [OrderConfirmationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParams } },
        },
      ],
    });

    fixture = TestBed.createComponent(OrderConfirmationPage);
    httpTesting = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpTesting.verify();
  });

  it('displays order confirmation details', () => {
    setup({ orderNumber: 'PCH-20240101-XXXX' });
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/confirmation/PCH-20240101-XXXX'),
    );
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        orderNumber: 'PCH-20240101-XXXX',
        status: 'PENDING',
        paymentMethod: 'COD',
        totalAmount: 59900,
        createdAt: '2024-01-01',
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Order Placed Successfully!');
    expect(el.textContent).toContain('PCH-20240101-XXXX');
    expect(el.textContent).toContain('Cash on Delivery');
  });

  it('shows error when order not found', () => {
    setup({ orderNumber: 'INVALID' });
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/confirmation/INVALID'),
    );
    req.flush({ success: false, message: 'Not found', code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Order not found');
  });

  it('shows PromptPay message for PROMPTPAY_QR orders', () => {
    setup({ orderNumber: 'PCH-20240101-QRQR' });
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/confirmation/PCH-20240101-QRQR'),
    );
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 2,
        orderNumber: 'PCH-20240101-QRQR',
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'PROMPTPAY_QR',
        totalAmount: 21900,
        createdAt: '2024-01-01',
      },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('PromptPay');
    expect(el.textContent).toContain('payment slip');
  });
});
