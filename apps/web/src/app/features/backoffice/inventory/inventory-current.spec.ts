import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BoCurrentInventoryPage } from './inventory-current';

const MOCK_PRODUCT = {
  id: 44,
  name: 'RTX 5070',
  slug: 'rtx-5070',
  sku: 'GPU-5070',
  stock: 0,
  stockState: 'OUT_OF_STOCK' as const,
  isActive: true,
  category: { id: 1, name: 'Graphics Cards', slug: 'graphics-cards' },
  brand: { id: 2, name: 'NVIDIA', slug: 'nvidia' },
};

describe('BoCurrentInventoryPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoCurrentInventoryPage],
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

  it('loads and renders products with current stock even without transaction history', () => {
    const fixture = TestBed.createComponent(BoCurrentInventoryPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/current') && r.method === 'GET',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [MOCK_PRODUCT],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Current Inventory');
    expect(el.textContent).toContain('RTX 5070');
    expect(el.textContent).toContain('GPU-5070');
    expect(el.textContent).toContain('0');
    expect(el.textContent).toContain('Out of stock');

    const detailLink = el.querySelector(
      'a[href*="/backoffice/inventory/products/44"]',
    );
    expect(detailLink).not.toBeNull();
  });

  it('sends supported search and stock-state filters to the API', () => {
    const fixture = TestBed.createComponent(BoCurrentInventoryPage);
    fixture.detectChanges();

    const initialReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/current') && r.method === 'GET',
    );
    initialReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    fixture.componentInstance['search'] = 'GPU-5070';
    fixture.componentInstance['stockStateFilter'] = 'OUT_OF_STOCK';
    fixture.componentInstance['onFilterChange']();

    const filteredReq = httpTesting.expectOne(
      (r) =>
        r.url.includes('/backoffice/inventory/current') &&
        r.method === 'GET' &&
        r.params.get('search') === 'GPU-5070' &&
        r.params.get('stockState') === 'OUT_OF_STOCK',
    );
    filteredReq.flush({
      success: true,
      message: 'OK',
      data: [MOCK_PRODUCT],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
