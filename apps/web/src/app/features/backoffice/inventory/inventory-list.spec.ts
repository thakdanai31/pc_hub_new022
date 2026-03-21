import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BoInventoryListPage } from './inventory-list';

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

describe('BoInventoryListPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoInventoryListPage],
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

  it('loads and renders inventory transactions', () => {
    const fixture = TestBed.createComponent(BoInventoryListPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/inventory') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [MOCK_TRANSACTION],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Inventory');
    expect(el.textContent).toContain('RTX 5070');
    expect(el.textContent).toContain('Manual restock from supplier delivery');
  });

  it('sends selected filters to the API', () => {
    const fixture = TestBed.createComponent(BoInventoryListPage);
    fixture.detectChanges();

    const initialReq = httpTesting.expectOne(
      (r) => r.url.includes('/backoffice/inventory') && r.method === 'GET',
    );
    initialReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    fixture.componentInstance['productIdFilter'] = 44 as never;
    fixture.componentInstance['referenceIdFilter'] = 9001 as never;

    expect(() => fixture.componentInstance['onTypeTab']('RESTOCK')).not.toThrow();

    const filteredReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory') &&
        r.method === 'GET' &&
        r.params.get('productId') === '44' &&
        r.params.get('referenceId') === '9001' &&
        r.params.get('type') === 'RESTOCK',
    );
    filteredReq.flush({
      success: true,
      message: 'OK',
      data: [MOCK_TRANSACTION],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
