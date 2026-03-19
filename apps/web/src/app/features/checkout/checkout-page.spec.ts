import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CheckoutPage } from './checkout-page';

const MOCK_ADDRESSES = {
  success: true,
  message: 'OK',
  data: [
    {
      id: 1,
      userId: 1,
      label: 'Home',
      recipientName: 'John',
      phoneNumber: '0811111111',
      line1: '123 Main',
      line2: null,
      district: 'A',
      subdistrict: 'B',
      province: 'Bangkok',
      postalCode: '10900',
      country: 'Thailand',
      isDefault: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ],
};

const MOCK_CART = {
  success: true,
  message: 'OK',
  data: {
    id: 1,
    items: [
      {
        id: 10,
        quantity: 1,
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

describe('CheckoutPage', () => {
  let fixture: ComponentFixture<CheckoutPage>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutPage);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads addresses and cart items in cart mode', () => {
    fixture.detectChanges();

    const addrReq = httpTesting.expectOne((r) => r.url.includes('/account/addresses'));
    addrReq.flush(MOCK_ADDRESSES);

    const cartReq = httpTesting.expectOne((r) => r.url.includes('/cart'));
    cartReq.flush(MOCK_CART);

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RTX 4090');
    expect(el.textContent).toContain('Home');
    expect(el.textContent).toContain('Cash on Delivery');
    expect(el.textContent).toContain('PromptPay QR');
  });

  it('selects default address automatically', () => {
    fixture.detectChanges();

    const addrReq = httpTesting.expectOne((r) => r.url.includes('/account/addresses'));
    addrReq.flush(MOCK_ADDRESSES);

    const cartReq = httpTesting.expectOne((r) => r.url.includes('/cart'));
    cartReq.flush(MOCK_CART);

    fixture.detectChanges();

    expect(fixture.componentInstance['selectedAddressId']()).toBe(1);
  });

  it('shows empty cart error when cart has no items', () => {
    fixture.detectChanges();

    const addrReq = httpTesting.expectOne((r) => r.url.includes('/account/addresses'));
    addrReq.flush(MOCK_ADDRESSES);

    const cartReq = httpTesting.expectOne((r) => r.url.includes('/cart'));
    cartReq.flush({ success: true, message: 'OK', data: { id: 1, items: [] } });

    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('cart is empty');
  });
});
