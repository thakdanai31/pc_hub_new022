import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogService);
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

  it('fetches categories with limit 100', () => {
    service.listCategories().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/categories') && r.params.get('limit') === '100',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'OK',
      data: [{ id: 1, name: 'GPUs', slug: 'gpus', description: null, parentId: null }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  it('fetches brands with limit 100', () => {
    service.listBrands().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/brands') && r.params.get('limit') === '100',
    );
    req.flush({
      success: true,
      message: 'OK',
      data: [{ id: 1, name: 'NVIDIA', slug: 'nvidia', logoUrl: null }],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  it('builds correct query params for product listing', () => {
    service
      .listProducts({ search: 'RTX', categoryId: '1', sort: 'price_asc' })
      .subscribe();

    const req = httpTesting.expectOne((r) => r.url.includes('/products'));
    expect(req.request.params.get('search')).toBe('RTX');
    expect(req.request.params.get('categoryId')).toBe('1');
    expect(req.request.params.get('sort')).toBe('price_asc');
    req.flush({
      success: true,
      message: 'OK',
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('fetches product by slug', () => {
    service.getProductBySlug('rtx-4090').subscribe((res) => {
      expect(res.data.name).toBe('RTX 4090');
    });

    const req = httpTesting.expectOne((r) =>
      r.url.includes('/products/slug/rtx-4090'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'OK',
      data: {
        id: 1,
        name: 'RTX 4090',
        slug: 'rtx-4090',
        sku: 'NV-4090',
        description: 'GPU',
        price: 59990,
        stock: 5,
        warrantyMonths: 36,
        isActive: true,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        category: { id: 1, name: 'GPUs', slug: 'gpus' },
        brand: { id: 1, name: 'NVIDIA', slug: 'nvidia' },
        images: [],
      },
    });
  });
});
