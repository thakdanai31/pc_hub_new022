import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { ThaiBahtPipe } from '../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import type { OrderConfirmation } from '../../shared/models/cart.model';

@Component({
  selector: 'app-order-confirmation',
  imports: [RouterLink, ThaiBahtPipe, AlertBanner, StatusBadge],
  templateUrl: './order-confirmation.html',
})
export class OrderConfirmationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<OrderConfirmation | null>(null);

  ngOnInit() {
    const orderNumber = this.route.snapshot.queryParams['orderNumber'] as string | undefined;

    if (!orderNumber) {
      this.router.navigate(['/products']);
      return;
    }

    this.cartService.getConfirmation(orderNumber).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Order not found.');
        this.loading.set(false);
      },
    });
  }
}
