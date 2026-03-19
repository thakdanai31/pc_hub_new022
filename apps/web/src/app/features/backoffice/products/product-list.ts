import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BackofficeCatalogService, type AdminProduct } from '../../../core/services/backoffice-catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-bo-product-list',
  imports: [RouterLink, FormsModule, ThaiBahtPipe, PageHeader, Pagination, ConfirmDialog, EmptyState],
  templateUrl: './product-list.html',
})
export class BoProductListPage implements OnInit {
  private readonly catalogService = inject(BackofficeCatalogService);
  private readonly auth = inject(AuthService);

  readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');

  protected readonly products = signal<AdminProduct[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);

  protected search = '';
  protected activeFilter = '';
  protected sortField = '';
  private currentPage = 1;
  private pendingDeleteProduct: AdminProduct | null = null;

  ngOnInit() {
    this.loadProducts();
  }

  protected isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadProducts();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadProducts();
  }

  onToggleActive(product: AdminProduct) {
    this.catalogService.toggleProductActive(product.id).subscribe({
      next: (res) => {
        const updated = this.products().map((p) =>
          p.id === product.id ? { ...p, isActive: res.data.isActive } : p,
        );
        this.products.set(updated);
      },
    });
  }

  confirmDelete(product: AdminProduct) {
    this.pendingDeleteProduct = product;
    this.deleteDialog()?.show();
  }

  onDeleteConfirmed() {
    if (!this.pendingDeleteProduct) return;
    this.catalogService.deleteProduct(this.pendingDeleteProduct.id).subscribe({
      next: () => {
        this.pendingDeleteProduct = null;
        this.loadProducts();
      },
    });
  }

  private loadProducts() {
    this.loading.set(true);
    this.catalogService
      .listProducts({
        page: this.currentPage,
        limit: 20,
        search: this.search || undefined,
        isActive: this.activeFilter ? this.activeFilter === 'true' : undefined,
        sort: this.sortField || undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
