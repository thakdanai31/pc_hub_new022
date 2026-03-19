import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CartService } from './cart.service';

const MOCK_CART = {
  success: true,
  message: 'OK',
  data: {
    id: 1,
    items: [
      {
        id: 10,
        quantity: 2,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        product: {
          id: 1,
          name: 'RTX 4090',
          slug: 'rtx-4090',
          sku: 'GPU-4090',
          price: 59900,
          stock: 5,
          isActive: true,
          image: null,
          category: { id: 1, name: 'GPUs', slug: 'gpus', isActive: true },
          brand: { id: 1, name: 'NVIDIA', slug: 'nvidia', isActive: true },
        },
      },
    ],
  },
};

describe('CartService', () => {
  let service: CartService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CartService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads cart and updates signal', () => {
    service.loadCart().subscribe((res) => {
      expect(res.data.items).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/cart'));
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_CART);

    expect(service.itemCount()).toBe(2);
  });

  it('adds item to cart', () => {
    service.addItem(1, 2).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/cart/items') && r.method === 'POST',
    );
    expect(req.request.body).toEqual({ productId: 1, quantity: 2 });
    req.flush(MOCK_CART);
  });

  it('updates cart item quantity', () => {
    service.updateItem(10, 3).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/cart/items/10') && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({ quantity: 3 });
    req.flush(MOCK_CART);
  });

  it('removes cart item', () => {
    service.removeItem(10).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/cart/items/10') && r.method === 'DELETE',
    );
    req.flush({ success: true, message: 'OK', data: { id: 1, items: [] } });

    expect(service.itemCount()).toBe(0);
  });

  it('clears cart', () => {
    service.clearCart().subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.endsWith('/cart') && r.method === 'DELETE',
    );
    req.flush({ success: true, message: 'OK', data: { id: 1, items: [] } });
  });

  it('sends checkout from cart request', () => {
    service.checkoutFromCart({
      addressId: 1,
      paymentMethod: 'COD',
    }).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/cart') && r.method === 'POST',
    );
    expect(req.request.body.addressId).toBe(1);
    expect(req.request.body.paymentMethod).toBe('COD');
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
  });

  it('sends buy-now request', () => {
    service.buyNow({
      productId: 1,
      quantity: 1,
      addressId: 1,
      paymentMethod: 'PROMPTPAY_QR',
    }).subscribe();

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/buy-now') && r.method === 'POST',
    );
    expect(req.request.body.productId).toBe(1);
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        orderNumber: 'PCH-20240101-YYYY',
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'PROMPTPAY_QR',
        totalAmount: 59900,
        createdAt: '2024-01-01',
      },
    });
  });

  it('fetches order confirmation', () => {
    service.getConfirmation('PCH-20240101-XXXX').subscribe((res) => {
      expect(res.data.orderNumber).toBe('PCH-20240101-XXXX');
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/checkout/confirmation/PCH-20240101-XXXX'),
    );
    expect(req.request.method).toBe('GET');
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
  });
});
