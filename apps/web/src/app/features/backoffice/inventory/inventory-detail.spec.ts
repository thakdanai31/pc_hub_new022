import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BoInventoryDetailPage } from './inventory-detail';

const MOCK_PRODUCT = {
  id: 44,
  name: 'RTX 5070',
  slug: 'rtx-5070',
  sku: 'GPU-5070',
  description: 'High-performance graphics card',
  price: 24990,
  stock: 12,
  warrantyMonths: 36,
  isActive: true,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
  category: { id: 1, name: 'Graphics Cards', slug: 'graphics-cards' },
  brand: { id: 2, name: 'NVIDIA', slug: 'nvidia' },
  images: [],
};

const MOCK_TRANSACTION = {
  id: 101,
  productId: 44,
  type: 'RESTOCK' as const,
  quantity: 5,
  referenceId: 9001,
  note: 'Manual restock from supplier delivery',
  createdAt: '2026-03-19T00:00:00.000Z',
  product: {
    id: 44,
    name: 'RTX 5070',
    slug: 'rtx-5070',
    sku: 'GPU-5070',
  },
};

describe('BoInventoryDetailPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoInventoryDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'productId' ? '44' : null),
              },
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

  it('loads product context and inventory history', () => {
    const fixture = TestBed.createComponent(BoInventoryDetailPage);
    fixture.detectChanges();

    const productReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/products/44') && r.method === 'GET',
    );
    productReq.flush({ success: true, message: 'OK', data: MOCK_PRODUCT });

    const historyReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/transactions') &&
        r.method === 'GET',
    );
    historyReq.flush({
      success: true,
      message: 'OK',
      data: [MOCK_TRANSACTION],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RTX 5070');
    expect(el.textContent).toContain('12 in stock');
    expect(el.textContent).toContain('Manual restock from supplier delivery');
  });

  it('submits restock through the dedicated restock endpoint', () => {
    const fixture = TestBed.createComponent(BoInventoryDetailPage);
    fixture.detectChanges();

    const productReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/products/44') && r.method === 'GET',
    );
    productReq.flush({ success: true, message: 'OK', data: MOCK_PRODUCT });

    const historyReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/transactions') &&
        r.method === 'GET',
    );
    historyReq.flush({
      success: true,
      message: 'OK',
      data: [MOCK_TRANSACTION],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    fixture.componentInstance['quantity'] = 4;
    fixture.componentInstance['note'] = 'Top-up from warehouse';
    fixture.componentInstance['onSubmitAction']();

    const restockReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/restock') &&
        r.method === 'POST',
    );
    expect(restockReq.request.body).toEqual({
      quantity: 4,
      note: 'Top-up from warehouse',
    });
    restockReq.flush({
      success: true,
      message: 'OK',
      data: {
        product: { id: 44, name: 'RTX 5070', slug: 'rtx-5070', sku: 'GPU-5070', stock: 16 },
        transaction: { ...MOCK_TRANSACTION, id: 102, quantity: 4, note: 'Top-up from warehouse' },
        previousStock: 12,
      },
    });

    const reloadReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/transactions') &&
        r.method === 'GET',
    );
    reloadReq.flush({
      success: true,
      message: 'OK',
      data: [{ ...MOCK_TRANSACTION, id: 102, quantity: 4, note: 'Top-up from warehouse' }],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it('submits adjust-out through the dedicated adjust-out endpoint', () => {
    const fixture = TestBed.createComponent(BoInventoryDetailPage);
    fixture.detectChanges();

    const productReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/products/44') && r.method === 'GET',
    );
    productReq.flush({ success: true, message: 'OK', data: MOCK_PRODUCT });

    const historyReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/transactions') &&
        r.method === 'GET',
    );
    historyReq.flush({
      success: true,
      message: 'OK',
      data: [MOCK_TRANSACTION],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    fixture.componentInstance['onActionTab']('ADJUSTMENT_OUT');
    fixture.componentInstance['quantity'] = 2;
    fixture.componentInstance['note'] = 'Damaged packaging write-off';
    fixture.componentInstance['onSubmitAction']();

    const adjustReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/adjust-out') &&
        r.method === 'POST',
    );
    expect(adjustReq.request.body).toEqual({
      quantity: 2,
      note: 'Damaged packaging write-off',
    });
    adjustReq.flush({
      success: true,
      message: 'OK',
      data: {
        product: { id: 44, name: 'RTX 5070', slug: 'rtx-5070', sku: 'GPU-5070', stock: 10 },
        transaction: {
          ...MOCK_TRANSACTION,
          id: 103,
          type: 'ADJUSTMENT_OUT',
          quantity: 2,
          note: 'Damaged packaging write-off',
        },
        previousStock: 12,
      },
    });

    const reloadReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/products/44/transactions') &&
        r.method === 'GET',
    );
    reloadReq.flush({
      success: true,
      message: 'OK',
      data: [
        {
          ...MOCK_TRANSACTION,
          id: 103,
          type: 'ADJUSTMENT_OUT',
          quantity: 2,
          note: 'Damaged packaging write-off',
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });
});
