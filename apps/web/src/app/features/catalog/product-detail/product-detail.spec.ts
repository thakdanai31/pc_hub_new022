import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { ProductDetailPage } from './product-detail';

const mockProduct = {
  id: 1,
  name: 'RTX 4090',
  slug: 'rtx-4090',
  sku: 'NV-4090',
  description: 'High-end GPU for gaming',
  price: 59990,
  stock: 5,
  warrantyMonths: 36,
  isActive: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  category: { id: 1, name: 'GPUs', slug: 'gpus' },
  brand: { id: 1, name: 'NVIDIA', slug: 'nvidia' },
  images: [
    { id: 1, imageUrl: 'https://img.example.com/front.jpg', altText: 'Front', sortOrder: 0 },
    { id: 2, imageUrl: 'https://img.example.com/back.jpg', altText: 'Back', sortOrder: 1 },
  ],
};

describe('ProductDetailPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: { slug: 'rtx-4090' },
              url: [{ path: 'products' }],
              queryParams: {},
            },
          },
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush any pending startup refresh requests from AuthService (created lazily during tests)
    const pendingRefresh = httpTesting.match((r) => r.url.includes('/auth/refresh'));
    for (const req of pendingRefresh) {
      req.flush({ message: 'No token' }, { status: 401, statusText: 'Unauthorized' });
    }
    httpTesting.verify();
  });

  it('renders product info', () => {
    const fixture = TestBed.createComponent(ProductDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) => r.url.includes('/products/slug/rtx-4090'));
    req.flush({ success: true, message: 'OK', data: mockProduct });

    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('RTX 4090');
    expect(el.textContent).toContain('NVIDIA');
    expect(el.textContent).toContain('59,990');
    expect(el.textContent).toContain('High-end GPU for gaming');
  });

  it('shows 404 state when product not found', () => {
    const fixture = TestBed.createComponent(ProductDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) => r.url.includes('/products/slug/rtx-4090'));
    req.flush(
      { success: false, message: 'Not found', code: 'NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );

    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Product Not Found');
  });

  it('renders image gallery with multiple images', () => {
    const fixture = TestBed.createComponent(ProductDetailPage);
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) => r.url.includes('/products/slug/rtx-4090'));
    req.flush({ success: true, message: 'OK', data: mockProduct });

    fixture.detectChanges();

    const images = fixture.nativeElement.querySelectorAll('img');
    // Main image + 2 thumbnails
    expect(images.length).toBe(3);
  });
});
