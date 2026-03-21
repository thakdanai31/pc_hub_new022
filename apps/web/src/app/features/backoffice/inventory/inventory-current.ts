import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BackofficeInventoryService,
  type CurrentInventoryRecord,
  type InventoryStockState,
} from '../../../core/services/backoffice-inventory.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

const STOCK_STATE_OPTIONS: { labelKey: string; value: InventoryStockState | '' }[] = [
  { labelKey: 'backoffice.inventory.allStockStates', value: '' },
  { labelKey: 'backoffice.inventory.inStock', value: 'IN_STOCK' },
  { labelKey: 'backoffice.inventory.lowStock', value: 'LOW_STOCK' },
  { labelKey: 'backoffice.inventory.outOfStock', value: 'OUT_OF_STOCK' },
];

function normalizeText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

@Component({
  selector: 'app-bo-current-inventory',
  imports: [
    RouterLink,
    FormsModule,
    AlertBanner,
    EmptyState,
    PageHeader,
    Pagination,
    StatusBadge,
    TranslatePipe,
  ],
  templateUrl: './inventory-current.html',
})
export class BoCurrentInventoryPage implements OnInit {
  private readonly inventoryService = inject(BackofficeInventoryService);
  protected readonly language = inject(LanguageService);

  protected readonly products = signal<CurrentInventoryRecord[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected search = '';
  protected stockStateFilter: InventoryStockState | '' = '';
  protected readonly stockStateOptions = STOCK_STATE_OPTIONS;

  private currentPage = 1;

  ngOnInit() {
    this.loadCurrentInventory();
  }

  protected onFilterChange() {
    this.currentPage = 1;
    this.loadCurrentInventory();
  }

  protected clearFilters() {
    this.search = '';
    this.stockStateFilter = '';
    this.onFilterChange();
  }

  protected hasActiveFilters(): boolean {
    return !!(normalizeText(this.search) || this.stockStateFilter);
  }

  protected goToPage(page: number) {
    this.currentPage = page;
    this.loadCurrentInventory();
  }

  protected stockStateLabel(state: InventoryStockState): string {
    switch (state) {
      case 'OUT_OF_STOCK':
        return this.language.translate('backoffice.inventory.outOfStock');
      case 'LOW_STOCK':
        return this.language.translate('backoffice.inventory.lowStock');
      default:
        return this.language.translate('backoffice.inventory.inStock');
    }
  }

  protected stockStateClass(state: InventoryStockState): string {
    if (state === 'OUT_OF_STOCK') {
      return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    }

    if (state === 'LOW_STOCK') {
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    }

    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  protected activeStatus(product: CurrentInventoryRecord): 'ACTIVE' | 'INACTIVE' {
    return product.isActive ? 'ACTIVE' : 'INACTIVE';
  }

  private loadCurrentInventory() {
    this.loading.set(true);
    this.error.set('');
    this.inventoryService
      .listCurrentInventory({
        page: this.currentPage,
        limit: 20,
        search: normalizeText(this.search),
        stockState: this.stockStateFilter || undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.language.translate('backoffice.inventory.currentLoadError'),
          );
          this.loading.set(false);
        },
      });
  }
}
