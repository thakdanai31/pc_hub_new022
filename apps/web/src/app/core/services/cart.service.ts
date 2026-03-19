import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { Cart, OrderConfirmation } from '../../shared/models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly cartData = signal<Cart | null>(null);

  readonly cart = this.cartData.asReadonly();
  readonly itemCount = computed(() => {
    const cart = this.cartData();
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  });

  loadCart() {
    return this.http
      .get<ApiResponse<Cart>>(`${this.apiUrl}/cart`)
      .pipe(tap((res) => this.cartData.set(res.data)));
  }

  addItem(productId: number, quantity: number) {
    return this.http
      .post<ApiResponse<Cart>>(`${this.apiUrl}/cart/items`, { productId, quantity })
      .pipe(tap((res) => this.cartData.set(res.data)));
  }

  updateItem(cartItemId: number, quantity: number) {
    return this.http
      .patch<ApiResponse<Cart>>(`${this.apiUrl}/cart/items/${cartItemId}`, { quantity })
      .pipe(tap((res) => this.cartData.set(res.data)));
  }

  removeItem(cartItemId: number) {
    return this.http
      .delete<ApiResponse<Cart>>(`${this.apiUrl}/cart/items/${cartItemId}`)
      .pipe(tap((res) => this.cartData.set(res.data)));
  }

  clearCart() {
    return this.http
      .delete<ApiResponse<Cart>>(`${this.apiUrl}/cart`)
      .pipe(tap((res) => this.cartData.set(res.data)));
  }

  checkoutFromCart(payload: {
    addressId: number;
    paymentMethod: string;
    customerNote?: string;
  }) {
    return this.http.post<ApiResponse<OrderConfirmation>>(
      `${this.apiUrl}/checkout/cart`,
      payload,
    );
  }

  buyNow(payload: {
    productId: number;
    quantity: number;
    addressId: number;
    paymentMethod: string;
    customerNote?: string;
  }) {
    return this.http.post<ApiResponse<OrderConfirmation>>(
      `${this.apiUrl}/checkout/buy-now`,
      payload,
    );
  }

  getConfirmation(orderNumber: string) {
    return this.http.get<ApiResponse<OrderConfirmation>>(
      `${this.apiUrl}/checkout/confirmation/${orderNumber}`,
    );
  }

  clearLocalCart() {
    this.cartData.set(null);
  }
}
