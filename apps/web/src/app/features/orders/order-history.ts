import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../core/services/order.service';
import { ThaiBahtPipe } from '../../shared/pipes/thai-baht.pipe';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AlertBanner } from '../../shared/components/alert-banner/alert-banner';
import { Pagination } from '../../shared/components/pagination/pagination';
import type { OrderSummary } from '../../shared/models/order.model';
import type { PaginationMeta } from '../../shared/models/pagination.model';

@Component({
  selector: 'app-order-history',
  imports: [RouterLink, DatePipe, FormsModule, ThaiBahtPipe, StatusBadge, EmptyState, AlertBanner, Pagination],
  templateUrl: './order-history.html',
})
export class OrderHistoryPage implements OnInit {
  private readonly orderService = inject(OrderService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<OrderSummary[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly statusFilter = signal('');
  private currentPage = 1;

  ngOnInit() {
    this.loadOrders();
  }

  onFilterChange(status: string) {
    this.statusFilter.set(status);
    this.currentPage = 1;
    this.loadOrders();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadOrders();
  }

  private loadOrders() {
    this.loading.set(true);
    this.error.set('');

    const filter = this.statusFilter();
    this.orderService.getOrders(this.currentPage, 10, filter || undefined).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.pagination.set(res.pagination);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load orders.');
        this.loading.set(false);
      },
    });
  }
}
