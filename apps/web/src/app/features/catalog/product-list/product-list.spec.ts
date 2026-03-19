import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductList } from './product-list';

function flushCatalogRequests(httpTesting: HttpTestingController) {
  // Flush categories
  const catReq = httpTesting.expectOne((r) => r.url.includes('/categories'));
  catReq.flush({
    success: true,
    message: 'OK',
    data: [{ id: 1, name: 'GPUs', slug: 'gpus', description: null, parentId: null }],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });

  // Flush brands
  const brandReq = httpTesting.expectOne((r) => r.url.includes('/brands'));
  brandReq.flush({
    success: true,
    message: 'OK',
    data: [{ id: 1, name: 'NVIDIA', slug: 'nvidia', logoUrl: null }],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });
}

describe('ProductList', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('renders product grid', () => {
    const fixture = TestBed.createComponent(ProductList);
    fixture.detectChanges();

    flushCatalogRequests(httpTesting);

    // Flush products
    const prodReq = httpTesting.expectOne((r) =>
      r.url.includes('/products') && !r.url.includes('/categories') && !r.url.includes('/brands'),
    );
    prodReq.flush({
      success: true,
      message: 'OK',
      data: [
        {
          id: 1,
          name: 'RTX 4090',
          slug: 'rtx-4090',
          sku: 'NV-4090',
          price: 59990,
          stock: 5,
          warrantyMonths: 36,
          category: { id: 1, name: 'GPUs', slug: 'gpus' },
          brand: { id: 1, name: 'NVIDIA', slug: 'nvidia' },
          image: null,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('RTX 4090');
  });

  it('shows empty state when no products', () => {
    const fixture = TestBed.createComponent(ProductList);
    fixture.detectChanges();

    flushCatalogRequests(httpTesting);

    const prodReq = httpTesting.expectOne((r) =>
      r.url.includes('/products') && !r.url.includes('/categories') && !r.url.includes('/brands'),
    );
    prodReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No products found');
  });

  it('shows loading skeleton initially', () => {
    const fixture = TestBed.createComponent(ProductList);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const skeletons = el.querySelectorAll('.shimmer');
    expect(skeletons.length).toBeGreaterThan(0);

    // Cleanup pending requests
    flushCatalogRequests(httpTesting);
    const prodReq = httpTesting.expectOne((r) =>
      r.url.includes('/products') && !r.url.includes('/categories') && !r.url.includes('/brands'),
    );
    prodReq.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
