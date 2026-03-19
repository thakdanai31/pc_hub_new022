import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CartPage } from './cart-page';

const EMPTY_CART = {
  success: true,
  message: 'OK',
  data: { id: 1, items: [] },
};

const CART_WITH_ITEMS = {
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

describe('CartPage', () => {
  let fixture: ComponentFixture<CartPage>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CartPage);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('shows empty cart message when no items', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) => r.url.includes('/cart'));
    req.flush(EMPTY_CART);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Your cart is empty');
  });

  it('displays cart items', () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne((r) => r.url.includes('/cart'));
    req.flush(CART_WITH_ITEMS);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RTX 4090');
    expect(el.textContent).toContain('NVIDIA');
  });

  it('shows loading skeleton initially', () => {
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.shimmer')).toBeTruthy();

    const req = httpTesting.expectOne((r) => r.url.includes('/cart'));
    req.flush(EMPTY_CART);
  });
});
