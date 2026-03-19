import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCard } from './product-card';
import type { ProductSummary } from '../../models/product.model';

function createProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    id: 1,
    name: 'RTX 4090',
    slug: 'rtx-4090',
    sku: 'NV-4090',
    price: 59990,
    stock: 5,
    warrantyMonths: 36,
    category: { id: 1, name: 'GPUs', slug: 'gpus' },
    brand: { id: 1, name: 'NVIDIA', slug: 'nvidia' },
    image: 'https://img.example.com/gpu.jpg',
    ...overrides,
  };
}

describe('ProductCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders product name and brand', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct());
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('RTX 4090');
    expect(el.textContent).toContain('NVIDIA');
  });

  it('renders price with Thai Baht format', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct());
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('59,990');
  });

  it('renders image when present', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct());
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(img?.src).toContain('gpu.jpg');
  });

  it('renders placeholder when image is null', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct({ image: null }));
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
    expect(img?.src).toContain('no-image.svg');
  });

  it('shows out of stock when stock is 0', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct({ stock: 0 }));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Out of Stock');
  });

  it('links to product detail page', () => {
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', createProduct());
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement | null;
    expect(link?.getAttribute('href')).toBe('/products/rtx-4090');
  });
});
