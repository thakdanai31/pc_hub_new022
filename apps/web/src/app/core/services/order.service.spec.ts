import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrderService);
    httpTesting = TestBed.inject(HttpTestingController);

    // Flush the startup restoreSession refresh request from AuthService
    await Promise.resolve();
    const startupReqs = httpTesting.match((r) => r.url.includes('/auth/refresh'));
    for (const req of startupReqs) {
      req.flush({ message: 'No token' }, { status: 401, statusText: 'Unauthorized' });
    }
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches paginated orders', () => {
    service.getOrders(1, 10).subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [{ id: 1, orderNumber: 'PCH-20240101-XXXX', status: 'PENDING', paymentMethod: 'COD', totalAmount: 21900, itemCount: 1, createdAt: '2024-01-01' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('fetches order detail', () => {
    service.getOrder(1).subscribe((res) => {
      expect(res.data.orderNumber).toBe('PCH-20240101-XXXX');
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1') && r.method === 'GET' && !r.url.includes('payment'),
    );
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 1, orderNumber: 'PCH-20240101-XXXX', status: 'PENDING', paymentMethod: 'COD',
        addressSnapshot: {}, subtotalAmount: 21900, shippingAmount: 0, totalAmount: 21900,
        customerNote: null, approvedAt: null, rejectedAt: null, rejectReason: null,
        createdAt: '2024-01-01', items: [], payment: null,
      },
    });
  });

  it('fetches PromptPay QR data', () => {
    service.getPromptPayQR(1).subscribe((res) => {
      expect(res.data.qrDataUrl).toContain('promptpay.io');
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1/promptpay') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: { qrDataUrl: 'https://promptpay.io/0812345678/21900.png', amount: 21900, promptPayId: '0812345678', orderNumber: 'PCH-20240101-XXXX' },
    });
  });

  it('uploads payment slip', () => {
    const file = new File(['test'], 'slip.jpg', { type: 'image/jpeg' });
    service.uploadSlip(1, file).subscribe((res) => {
      expect(res.data.imageUrl).toBeDefined();
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/account/orders/1/payment-slip') && r.method === 'POST',
    );
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({
      success: true,
      message: 'OK',
      data: { imageUrl: 'https://example.com/slip.jpg', uploadedAt: '2024-01-01' },
    });
  });
});
