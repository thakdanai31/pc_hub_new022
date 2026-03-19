import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CartService } from '../../core/services/cart.service';
import { ThaiBahtPipe } from '../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import type { CartItem } from '../../shared/models/cart.model';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, ThaiBahtPipe, AlertBanner, EmptyState, ConfirmDialog],
  templateUrl: './cart-page.html',
})
export class CartPage implements OnInit {
  protected readonly cartService = inject(CartService);

  readonly clearDialog = viewChild<ConfirmDialog>('clearDialog');

  readonly loading = signal(true);
  readonly error = signal('');
  readonly updatingItemId = signal<number | null>(null);

  readonly items = signal<CartItem[]>([]);
  readonly subtotal = signal(0);

  ngOnInit() {
    this.loadCart();
  }

  loadCart() {
    this.loading.set(true);
    this.error.set('');

    this.cartService.loadCart().subscribe({
      next: (res) => {
        this.items.set(res.data.items);
        this.recalcSubtotal(res.data.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load cart. Please try again.');
        this.loading.set(false);
      },
    });
  }

  incrementQuantity(item: CartItem) {
    this.updatingItemId.set(item.id);
    this.cartService.updateItem(item.id, item.quantity + 1).subscribe({
      next: (res) => {
        this.items.set(res.data.items);
        this.recalcSubtotal(res.data.items);
        this.updatingItemId.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingItemId.set(null);
        if (err.status === 400) {
          this.error.set('Cannot increase quantity. Stock limit reached.');
        }
      },
    });
  }

  decrementQuantity(item: CartItem) {
    if (item.quantity <= 1) return;
    this.updatingItemId.set(item.id);
    this.cartService.updateItem(item.id, item.quantity - 1).subscribe({
      next: (res) => {
        this.items.set(res.data.items);
        this.recalcSubtotal(res.data.items);
        this.updatingItemId.set(null);
      },
      error: () => {
        this.updatingItemId.set(null);
      },
    });
  }

  removeItem(cartItemId: number) {
    this.updatingItemId.set(cartItemId);
    this.cartService.removeItem(cartItemId).subscribe({
      next: (res) => {
        this.items.set(res.data.items);
        this.recalcSubtotal(res.data.items);
        this.updatingItemId.set(null);
      },
      error: () => {
        this.updatingItemId.set(null);
      },
    });
  }

  confirmClearCart() {
    this.clearDialog()?.show();
  }

  clearAll() {
    this.cartService.clearCart().subscribe({
      next: (res) => {
        this.items.set(res.data.items);
        this.recalcSubtotal(res.data.items);
      },
    });
  }

  private recalcSubtotal(cartItems: CartItem[]) {
    const total = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
    this.subtotal.set(total);
  }
}
