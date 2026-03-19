import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogService } from '../../../core/services/catalog.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import type { ProductDetail as ProductDetailModel } from '../../../shared/models/product.model';

@Component({
  selector: 'app-product-detail',
  imports: [RouterLink, ThaiBahtPipe, AlertBanner, EmptyState],
  templateUrl: './product-detail.html',
})
export class ProductDetailPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly cartService = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly product = signal<ProductDetailModel | null>(null);
  readonly selectedImage = signal<string | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly error = signal('');
  readonly quantity = signal(1);
  readonly addingToCart = signal(false);
  readonly cartMessage = signal('');
  readonly cartError = signal('');

  private slug = '';

  ngOnInit() {
    this.slug = this.route.snapshot.params['slug'] as string;
    this.loadProduct();
  }

  loadProduct() {
    this.loading.set(true);
    this.error.set('');
    this.notFound.set(false);

    this.catalog.getProductBySlug(this.slug).subscribe({
      next: (res) => {
        this.product.set(res.data);
        const firstImage = res.data.images[0]?.imageUrl ?? null;
        this.selectedImage.set(firstImage);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set('Failed to load product. Please try again.');
        }
        this.loading.set(false);
      },
    });
  }

  selectImage(url: string) {
    this.selectedImage.set(url);
  }

  incrementQty(maxStock: number) {
    if (this.quantity() < maxStock) {
      this.quantity.update((q) => q + 1);
    }
  }

  decrementQty() {
    if (this.quantity() > 1) {
      this.quantity.update((q) => q - 1);
    }
  }

  addToCart(productId: number) {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.addingToCart.set(true);
    this.cartMessage.set('');
    this.cartError.set('');

    this.cartService.addItem(productId, this.quantity()).subscribe({
      next: () => {
        this.addingToCart.set(false);
        this.cartMessage.set('Added to cart!');
        setTimeout(() => this.cartMessage.set(''), 3000);
      },
      error: (err: HttpErrorResponse) => {
        this.addingToCart.set(false);
        const body = err.error as Record<string, unknown>;
        this.cartError.set(
          typeof body['message'] === 'string' ? body['message'] : 'Failed to add to cart.',
        );
      },
    });
  }

  buyNow(productId: number) {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.router.navigate(['/checkout'], {
      queryParams: {
        mode: 'buy-now',
        productId,
        quantity: this.quantity(),
      },
    });
  }
}
