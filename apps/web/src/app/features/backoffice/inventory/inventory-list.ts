import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BackofficeInventoryService,
  type InventoryTransactionRecord,
  type InventoryTransactionType,
} from '../../../core/services/backoffice-inventory.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

const INVENTORY_TYPE_TABS: { labelKey: string; value: InventoryTransactionType | '' }[] = [
  { labelKey: 'common.all', value: '' },
  { labelKey: 'enum.RESTOCK', value: 'RESTOCK' },
  { labelKey: 'enum.SALE', value: 'SALE' },
  { labelKey: 'enum.ADJUSTMENT_IN', value: 'ADJUSTMENT_IN' },
  { labelKey: 'enum.ADJUSTMENT_OUT', value: 'ADJUSTMENT_OUT' },
  { labelKey: 'enum.RETURN_IN', value: 'RETURN_IN' },
  { labelKey: 'enum.RETURN_OUT', value: 'RETURN_OUT' },
];

const STOCK_IN_TYPES = new Set<InventoryTransactionType>([
  'RESTOCK',
  'ADJUSTMENT_IN',
  'RETURN_IN',
]);

function parsePositiveInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

@Component({
  selector: 'app-bo-inventory-list',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    AlertBanner,
    EmptyState,
    PageHeader,
    Pagination,
    StatusBadge,
    TranslatePipe,
  ],
  templateUrl: './inventory-list.html',
})
export class BoInventoryListPage implements OnInit {
  private readonly inventoryService = inject(BackofficeInventoryService);
  protected readonly language = inject(LanguageService);

  protected readonly transactions = signal<InventoryTransactionRecord[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected productIdFilter = '';
  protected referenceIdFilter = '';
  protected typeFilter: InventoryTransactionType | '' = '';
  protected readonly typeTabs = INVENTORY_TYPE_TABS;
  private currentPage = 1;

  ngOnInit() {
    this.loadTransactions();
  }

  protected onFilterChange() {
    this.currentPage = 1;
    this.loadTransactions();
  }

  protected onTypeTab(value: InventoryTransactionType | '') {
    this.typeFilter = value;
    this.onFilterChange();
  }

  protected hasActiveFilters(): boolean {
    return !!(this.typeFilter || this.productIdFilter || this.referenceIdFilter);
  }

  protected clearFilters() {
    this.typeFilter = '';
    this.productIdFilter = '';
    this.referenceIdFilter = '';
    this.onFilterChange();
  }

  protected goToPage(page: number) {
    this.currentPage = page;
    this.loadTransactions();
  }

  protected formatQuantity(transaction: InventoryTransactionRecord): string {
    const prefix = STOCK_IN_TYPES.has(transaction.type) ? '+' : '-';
    return `${prefix}${transaction.quantity}`;
  }

  protected quantityClass(transaction: InventoryTransactionRecord): string {
    return STOCK_IN_TYPES.has(transaction.type)
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-rose-700 bg-rose-50';
  }

  protected loadTransactions() {
    this.loading.set(true);
    this.error.set('');
    this.inventoryService
      .listTransactions({
        page: this.currentPage,
        limit: 20,
        productId: parsePositiveInteger(this.productIdFilter),
        type: this.typeFilter || undefined,
        referenceId: parsePositiveInteger(this.referenceIdFilter),
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.language.translate('backoffice.inventory.loadError'),
          );
          this.loading.set(false);
        },
      });
  }
}
