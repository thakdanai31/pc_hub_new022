import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BackofficeInventoryService,
  type InventoryMutationBody,
  type InventoryTransactionRecord,
  type InventoryTransactionType,
} from '../../../core/services/backoffice-inventory.service';
import {
  BackofficeCatalogService,
  type AdminProductDetail,
} from '../../../core/services/backoffice-catalog.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

type InventoryManualAction = 'RESTOCK' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

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

const ACTION_META: Record<
  InventoryManualAction,
  {
    labelKey: string;
    descriptionKey: string;
    buttonClass: string;
    successMessageKey: string;
  }
> = {
  RESTOCK: {
    labelKey: 'enum.RESTOCK',
    descriptionKey: 'backoffice.inventory.restockDescription',
    buttonClass:
      'bg-emerald-600 hover:bg-emerald-500 text-white',
    successMessageKey: 'backoffice.inventory.restockSuccess',
  },
  ADJUSTMENT_IN: {
    labelKey: 'enum.ADJUSTMENT_IN',
    descriptionKey: 'backoffice.inventory.adjustInDescription',
    buttonClass:
      'bg-sky-600 hover:bg-sky-500 text-white',
    successMessageKey: 'backoffice.inventory.adjustInSuccess',
  },
  ADJUSTMENT_OUT: {
    labelKey: 'enum.ADJUSTMENT_OUT',
    descriptionKey: 'backoffice.inventory.adjustOutDescription',
    buttonClass:
      'bg-orange-600 hover:bg-orange-500 text-white',
    successMessageKey: 'backoffice.inventory.adjustOutSuccess',
  },
};

function parsePositiveInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

@Component({
  selector: 'app-bo-inventory-detail',
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    AlertBanner,
    EmptyState,
    Pagination,
    StatusBadge,
    TranslatePipe,
  ],
  templateUrl: './inventory-detail.html',
})
export class BoInventoryDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(BackofficeInventoryService);
  private readonly catalogService = inject(BackofficeCatalogService);
  protected readonly language = inject(LanguageService);

  protected readonly product = signal<AdminProductDetail | null>(null);
  protected readonly transactions = signal<InventoryTransactionRecord[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly historyLoading = signal(false);
  protected readonly actionSaving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly historyError = signal('');
  protected readonly successMsg = signal('');

  protected typeFilter: InventoryTransactionType | '' = '';
  protected referenceIdFilter = '';
  protected readonly typeTabs = INVENTORY_TYPE_TABS;
  protected readonly manualActions: InventoryManualAction[] = [
    'RESTOCK',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
  ];
  protected actionType: InventoryManualAction = 'RESTOCK';
  protected quantity: number | null = 1;
  protected actionReferenceId = '';
  protected note = '';

  private productId = 0;
  private currentPage = 1;

  ngOnInit() {
    const productId = Number(this.route.snapshot.paramMap.get('productId'));
    if (!productId) {
      this.errorMsg.set(this.language.translate('backoffice.inventory.productNotFound'));
      this.loading.set(false);
      return;
    }

    this.productId = productId;
    this.loadProduct();
  }

  protected onTypeTab(value: InventoryTransactionType | '') {
    this.typeFilter = value;
    this.currentPage = 1;
    this.loadTransactions();
  }

  protected onHistoryFilterChange() {
    this.currentPage = 1;
    this.loadTransactions();
  }

  protected hasHistoryFilters(): boolean {
    return !!(this.typeFilter || this.referenceIdFilter);
  }

  protected clearHistoryFilters() {
    this.typeFilter = '';
    this.referenceIdFilter = '';
    this.onHistoryFilterChange();
  }

  protected goToPage(page: number) {
    this.currentPage = page;
    this.loadTransactions();
  }

  protected quantityClass(transaction: InventoryTransactionRecord): string {
    return STOCK_IN_TYPES.has(transaction.type)
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-rose-700 bg-rose-50';
  }

  protected formatQuantity(transaction: InventoryTransactionRecord): string {
    const prefix = STOCK_IN_TYPES.has(transaction.type) ? '+' : '-';
    return `${prefix}${transaction.quantity}`;
  }

  protected stockBadgeClass(stock: number): string {
    if (stock <= 0) {
      return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    }
    if (stock <= 10) {
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    }
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  protected stockSummaryLabel(stock: number): string {
    if (stock <= 0) return this.language.translate('backoffice.inventory.outOfStock');
    if (stock <= 10) return this.language.translate('backoffice.inventory.lowStock');
    return this.language.translate('backoffice.inventory.inStock');
  }

  protected actionMeta() {
    return ACTION_META[this.actionType];
  }

  protected actionLabel(action: InventoryManualAction): string {
    return this.language.translate(ACTION_META[action].labelKey);
  }

  protected onActionTab(action: InventoryManualAction) {
    this.actionType = action;
  }

  protected canSubmitAction(): boolean {
    if (this.actionSaving()) return false;
    if (this.quantity === null) return false;

    return Number.isInteger(Number(this.quantity)) && Number(this.quantity) > 0;
  }

  protected onSubmitAction() {
    if (!this.canSubmitAction() || !this.productId) return;

    const body: InventoryMutationBody = {
      quantity: Number(this.quantity),
    };

    const referenceId = parsePositiveInteger(this.actionReferenceId);
    if (referenceId) {
      body.referenceId = referenceId;
    }

    const trimmedNote = this.note.trim();
    if (trimmedNote) {
      body.note = trimmedNote;
    }

    this.actionSaving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const request =
      this.actionType === 'RESTOCK'
        ? this.inventoryService.restockProduct(this.productId, body)
        : this.actionType === 'ADJUSTMENT_IN'
          ? this.inventoryService.adjustInventoryIn(this.productId, body)
          : this.inventoryService.adjustInventoryOut(this.productId, body);

    request.subscribe({
      next: (res) => {
        const currentProduct = this.product();
        if (currentProduct) {
          this.product.set({
            ...currentProduct,
            stock: res.data.product.stock,
          });
        }

        this.successMsg.set(
          this.language.translate(this.actionMeta().successMessageKey),
        );
        this.actionSaving.set(false);
        this.resetActionForm();
        this.currentPage = 1;
        this.loadTransactions();
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.errorMsg.set(
          errorBody.message ??
            this.language.translate('backoffice.inventory.failedUpdate'),
        );
        this.actionSaving.set(false);
      },
    });
  }

  protected resetActionForm() {
    this.quantity = 1;
    this.actionReferenceId = '';
    this.note = '';
  }

  private loadProduct() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.catalogService.getProduct(this.productId).subscribe({
      next: (res) => {
        this.product.set(res.data);
        this.loadTransactions(true);
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.errorMsg.set(
          errorBody.message ??
            this.language.translate('backoffice.inventory.productInventoryError'),
        );
        this.loading.set(false);
      },
    });
  }

  protected loadTransactions(initialLoad = false) {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.inventoryService
      .getProductTransactions(this.productId, {
        page: this.currentPage,
        limit: 20,
        type: this.typeFilter || undefined,
        referenceId: parsePositiveInteger(this.referenceIdFilter),
      })
      .subscribe({
        next: (res) => {
          this.transactions.set(res.data);
          this.pagination.set(res.pagination);
          this.historyLoading.set(false);
          if (initialLoad) {
            this.loading.set(false);
          }
        },
        error: (err) => {
          const errorBody = extractErrorBody(err.error);
          this.historyError.set(
            errorBody.message ??
              this.language.translate('backoffice.inventory.productHistoryError'),
          );
          this.historyLoading.set(false);
          if (initialLoad) {
            this.loading.set(false);
          }
        },
      });
  }
}
