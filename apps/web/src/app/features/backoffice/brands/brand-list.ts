import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BackofficeCatalogService, type AdminBrand } from '../../../core/services/backoffice-catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-bo-brand-list',
  imports: [RouterLink, FormsModule, PageHeader, Pagination, ConfirmDialog, EmptyState],
  templateUrl: './brand-list.html',
})
export class BoBrandListPage implements OnInit {
  private readonly catalogService = inject(BackofficeCatalogService);
  private readonly auth = inject(AuthService);

  readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');

  protected readonly brands = signal<AdminBrand[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);

  protected search = '';
  private currentPage = 1;
  private pendingDeleteBrand: AdminBrand | null = null;

  ngOnInit() {
    this.loadBrands();
  }

  protected isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadBrands();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadBrands();
  }

  onToggleActive(brand: AdminBrand) {
    this.catalogService.toggleBrandActive(brand.id).subscribe({
      next: (res) => {
        const updated = this.brands().map((b) =>
          b.id === brand.id ? { ...b, isActive: res.data.isActive } : b,
        );
        this.brands.set(updated);
      },
    });
  }

  confirmDelete(brand: AdminBrand) {
    this.pendingDeleteBrand = brand;
    this.deleteDialog()?.show();
  }

  onDeleteConfirmed() {
    if (!this.pendingDeleteBrand) return;
    this.catalogService.deleteBrand(this.pendingDeleteBrand.id).subscribe({
      next: () => {
        this.pendingDeleteBrand = null;
        this.loadBrands();
      },
    });
  }

  private loadBrands() {
    this.loading.set(true);
    this.catalogService
      .listBrands({
        page: this.currentPage,
        limit: 20,
        search: this.search || undefined,
      })
      .subscribe({
        next: (res) => {
          this.brands.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
