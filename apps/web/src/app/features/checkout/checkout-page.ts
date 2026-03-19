import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { AddressService } from '../../core/services/address.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ThaiBahtPipe } from '../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../shared/components/alert-banner/alert-banner';
import type { Address } from '../../shared/models/address.model';
import type { CartItem, CheckoutInvalidItem } from '../../shared/models/cart.model';

interface CheckoutItem {
  name: string;
  price: number;
  quantity: number;
  image: string | null;
}

@Component({
  selector: 'app-checkout-page',
  imports: [RouterLink, FormsModule, ThaiBahtPipe, AlertBanner],
  templateUrl: './checkout-page.html',
})
export class CheckoutPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly addressService = inject(AddressService);
  private readonly catalogService = inject(CatalogService);

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly submitting = signal(false);
  readonly checkoutError = signal('');
  readonly invalidItems = signal<CheckoutInvalidItem[]>([]);

  readonly addresses = signal<Address[]>([]);
  readonly selectedAddressId = signal<number | null>(null);
  readonly paymentMethod = signal<'COD' | 'PROMPTPAY_QR'>('COD');
  readonly checkoutItems = signal<CheckoutItem[]>([]);
  readonly subtotal = signal(0);

  customerNote = '';

  private isBuyNow = false;
  private buyNowProductId = 0;
  private buyNowQuantity = 0;

  readonly canSubmit = computed(() => {
    return (
      this.selectedAddressId() !== null &&
      this.checkoutItems().length > 0 &&
      !this.submitting()
    );
  });

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    this.isBuyNow = params['mode'] === 'buy-now';

    if (this.isBuyNow) {
      const pid = Number(params['productId']);
      const qty = Number(params['quantity']);
      if (!pid || pid <= 0 || !qty || qty <= 0) {
        this.router.navigate(['/products']);
        return;
      }
      this.buyNowProductId = pid;
      this.buyNowQuantity = qty;
    }

    this.loadData();
  }

  placeOrder() {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.checkoutError.set('');
    this.invalidItems.set([]);

    const addressId = this.selectedAddressId();
    if (addressId === null) return;
    const note = this.customerNote.trim() || undefined;

    const obs = this.isBuyNow
      ? this.cartService.buyNow({
        productId: this.buyNowProductId,
        quantity: this.buyNowQuantity,
        addressId,
        paymentMethod: this.paymentMethod(),
        customerNote: note,
      })
      : this.cartService.checkoutFromCart({
        addressId,
        paymentMethod: this.paymentMethod(),
        customerNote: note,
      });

    obs.subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.router.navigate(['/checkout/confirmation'], {
          queryParams: { orderNumber: res.data.orderNumber },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const body = err.error as Record<string, unknown>;
        const msg = typeof body['message'] === 'string' ? body['message'] : 'Checkout failed. Please try again.';
        this.checkoutError.set(msg);

        if (Array.isArray(body['invalidItems'])) {
          this.invalidItems.set(body['invalidItems'] as CheckoutInvalidItem[]);
        }
      },
    });
  }

  private loadData() {
    this.loading.set(true);

    // Load addresses
    this.addressService.list().subscribe({
      next: (res) => {
        this.addresses.set(res.data);
        const defaultAddr = res.data.find((a) => a.isDefault);
        if (defaultAddr) {
          this.selectedAddressId.set(defaultAddr.id);
        } else if (res.data.length > 0) {
          const firstAddress = res.data[0];
          if (firstAddress) {
            this.selectedAddressId.set(firstAddress.id);
          }
        }

        // Load items
        if (this.isBuyNow) {
          this.loadBuyNowProduct();
        } else {
          this.loadCartItems();
        }
      },
      error: () => {
        this.loadError.set('Failed to load addresses.');
        this.loading.set(false);
      },
    });
  }

  private loadCartItems() {
    this.cartService.loadCart().subscribe({
      next: (res) => {
        if (res.data.items.length === 0) {
          this.loadError.set('Your cart is empty.');
          this.loading.set(false);
          return;
        }

        const items: CheckoutItem[] = res.data.items.map((ci: CartItem) => ({
          name: ci.product.name,
          price: ci.product.price,
          quantity: ci.quantity,
          image: ci.product.image,
        }));

        this.checkoutItems.set(items);
        this.subtotal.set(
          items.reduce((sum, i) => sum + i.price * i.quantity, 0),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Failed to load cart.');
        this.loading.set(false);
      },
    });
  }

  private loadBuyNowProduct() {
    this.catalogService.getProductById(this.buyNowProductId).subscribe({
      next: (res) => {
        const p = res.data;
        this.checkoutItems.set([
          {
            name: p.name,
            price: p.price,
            quantity: this.buyNowQuantity,
            image: p.images[0]?.imageUrl ?? null,
          },
        ]);
        this.subtotal.set(p.price * this.buyNowQuantity);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Product not found.');
        this.loading.set(false);
      },
    });
  }
}
