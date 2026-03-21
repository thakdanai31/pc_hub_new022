import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BoProductFormPage } from './product-form';

const MOCK_PRODUCT = {
  id: 55,
  name: 'RTX 5090',
  slug: 'rtx-5090',
  sku: 'GPU-5090',
  description: 'Flagship graphics card',
  price: 99990,
  stock: 8,
  warrantyMonths: 36,
  isActive: true,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
  category: { id: 1, name: 'Graphics Cards', slug: 'graphics-cards' },
  brand: { id: 2, name: 'NVIDIA', slug: 'nvidia' },
  images: [
    {
      id: 700,
      imageUrl: 'https://img.example.com/front.jpg',
      altText: 'Front',
      sortOrder: 0,
    },
    {
      id: 701,
      imageUrl: 'https://img.example.com/side.jpg',
      altText: 'Side',
      sortOrder: 1,
    },
  ],
};

function flushInitialRequests(httpTesting: HttpTestingController) {
  const productReq = httpTesting.expectOne(
    (request) =>
      request.url.includes('/backoffice/products/55') &&
      request.method === 'GET',
  );
  productReq.flush({ success: true, message: 'OK', data: MOCK_PRODUCT });

  const categoriesReq = httpTesting.expectOne(
    (request) =>
      request.url.includes('/backoffice/categories') &&
      request.method === 'GET',
  );
  categoriesReq.flush({
    success: true,
    message: 'OK',
    data: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });

  const brandsReq = httpTesting.expectOne(
    (request) =>
      request.url.includes('/backoffice/brands') &&
      request.method === 'GET',
  );
  brandsReq.flush({
    success: true,
    message: 'OK',
    data: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
}

describe('BoProductFormPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoProductFormPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'productId' ? '55' : null),
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

  it('shows a set-as-primary action only for non-primary existing images', () => {
    const fixture = TestBed.createComponent(BoProductFormPage);
    fixture.detectChanges();
    flushInitialRequests(httpTesting);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const actionButtons = Array.from(element.querySelectorAll('button')).filter(
      (button) => button.textContent?.includes('Set as primary'),
    );

    expect(actionButtons).toHaveLength(1);
    expect(element.textContent).toContain('Primary');
  });

  it('calls the set-primary endpoint and reloads the product', () => {
    const fixture = TestBed.createComponent(BoProductFormPage);
    fixture.detectChanges();
    flushInitialRequests(httpTesting);
    fixture.detectChanges();

    fixture.componentInstance.setExistingPrimaryImage(701);

    const setPrimaryReq = httpTesting.expectOne(
      (request) =>
        request.url.includes('/backoffice/products/55/images/701/set-primary') &&
        request.method === 'POST',
    );
    expect(setPrimaryReq.request.body).toEqual({});
    setPrimaryReq.flush({
      success: true,
      message: 'Primary image updated',
      data: {
        images: [
          { ...MOCK_PRODUCT.images[1], sortOrder: 0 },
          { ...MOCK_PRODUCT.images[0], sortOrder: 1 },
        ],
      },
    });

    const reloadReq = httpTesting.expectOne(
      (request) =>
        request.url.includes('/backoffice/products/55') &&
        request.method === 'GET',
    );
    reloadReq.flush({
      success: true,
      message: 'OK',
      data: {
        ...MOCK_PRODUCT,
        images: [
          { ...MOCK_PRODUCT.images[1], sortOrder: 0 },
          { ...MOCK_PRODUCT.images[0], sortOrder: 1 },
        ],
      },
    });
  });
});
