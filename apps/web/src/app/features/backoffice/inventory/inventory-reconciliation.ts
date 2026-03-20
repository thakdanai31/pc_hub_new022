import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BackofficeInventoryService,
  type InventoryReconciliationAction,
  type InventoryReconciliationBackfillPayload,
  type InventoryReconciliationIssue,
  type InventoryReconciliationOrderRow,
  type InventoryReconciliationOrderStatus,
  type InventoryReconciliationResultStatus,
  type InventoryReconciliationState,
} from '../../../core/services/backoffice-inventory.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import type { PaginationMeta } from '../../../shared/models/pagination.model';
import { extractErrorBody } from '../../../shared/utils/error.utils';

const ORDER_STATUS_OPTIONS: { label: string; value: InventoryReconciliationOrderStatus | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Awaiting Payment', value: 'AWAITING_PAYMENT' },
  { label: 'Payment Submitted', value: 'PAYMENT_SUBMITTED' },
  { label: 'Payment Review', value: 'PAYMENT_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const RECONCILIATION_STATE_LABELS: Record<InventoryReconciliationState, string> = {
  COMMITTED: 'Committed',
  COMMITTED_CANCELLED: 'Committed Cancelled',
  NOT_COMMITTED: 'Not Committed',
  AMBIGUOUS_CANCELLED: 'Ambiguous Cancelled',
};

const RESULT_STATUS_BADGES: Record<
  InventoryReconciliationResultStatus,
  'PLANNED' | 'APPLIED' | 'SKIPPED' | 'FAILED'
> = {
  planned: 'PLANNED',
  applied: 'APPLIED',
  skipped: 'SKIPPED',
  failed: 'FAILED',
};

const RESULT_STATUS_LABELS: Record<InventoryReconciliationResultStatus, string> = {
  planned: 'Planned',
  applied: 'Applied',
  skipped: 'Skipped',
  failed: 'Failed',
};

function parsePositiveInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

@Component({
  selector: 'app-bo-inventory-reconciliation',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    AlertBanner,
    ConfirmDialog,
    EmptyState,
    PageHeader,
    Pagination,
    StatusBadge,
  ],
  templateUrl: './inventory-reconciliation.html',
})
export class BoInventoryReconciliationPage implements OnInit {
  private readonly inventoryService = inject(BackofficeInventoryService);

  protected readonly applyDialog = viewChild<ConfirmDialog>('applyDialog');
  protected readonly rows = signal<InventoryReconciliationOrderRow[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly summary = signal<{
    scannedOrders: number;
    ordersWithIssues: number;
    autoFixableOrders: number;
    manualReviewOrders: number;
    issueCounts: Record<string, number>;
  } | null>(null);
  protected readonly selectedOrderIds = signal<number[]>([]);
  protected readonly lastBackfill = signal<InventoryReconciliationBackfillPayload | null>(null);
  protected readonly reviewedSelectionKey = signal('');
  protected readonly loading = signal(true);
  protected readonly actionLoading = signal(false);
  protected readonly actionMode = signal<'dryRun' | 'apply' | null>(null);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly actionSuccess = signal('');

  protected orderIdFilter = '';
  protected statusFilter: InventoryReconciliationOrderStatus | '' = '';
  protected dateFrom = '';
  protected dateTo = '';
  protected readonly statusOptions = ORDER_STATUS_OPTIONS;

  private currentPage = 1;

  ngOnInit() {
    this.loadReport();
  }

  protected onFilterChange() {
    this.currentPage = 1;
    this.resetSelectionState();
    this.loadReport();
  }

  protected clearFilters() {
    this.orderIdFilter = '';
    this.statusFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.onFilterChange();
  }

  protected hasActiveFilters(): boolean {
    return !!(
      this.orderIdFilter ||
      this.statusFilter ||
      this.dateFrom ||
      this.dateTo
    );
  }

  protected goToPage(page: number) {
    this.currentPage = page;
    this.resetSelectionState();
    this.loadReport();
  }

  protected loadReport() {
    this.loading.set(true);
    this.error.set('');
    this.inventoryService
      .getReconciliationReport({
        page: this.currentPage,
        limit: 20,
        orderId: parsePositiveInteger(this.orderIdFilter),
        status: this.statusFilter || undefined,
        dateFrom: this.dateFrom || undefined,
        dateTo: this.dateTo || undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data.rows);
          this.pagination.set(res.data.pagination);
          this.summary.set(res.data.summary);
          this.loading.set(false);
        },
        error: (err) => {
          const errorBody = extractErrorBody(err.error);
          this.error.set(
            errorBody.message ?? 'Failed to load reconciliation findings.',
          );
          this.loading.set(false);
        },
      });
  }

  protected selectableOrderIdsOnPage(): number[] {
    return this.rows()
      .filter((row) => row.autoFixable)
      .map((row) => row.orderId);
  }

  protected hasSelectableRows(): boolean {
    return this.selectableOrderIdsOnPage().length > 0;
  }

  protected isSelected(orderId: number): boolean {
    return this.selectedOrderIds().includes(orderId);
  }

  protected toggleSelection(orderId: number, checked: boolean) {
    const current = new Set(this.selectedOrderIds());
    if (checked) {
      current.add(orderId);
    } else {
      current.delete(orderId);
    }

    this.selectedOrderIds.set(Array.from(current).sort((a, b) => a - b));
    this.actionSuccess.set('');
  }

  protected allSelectableOnPageSelected(): boolean {
    const selectableIds = this.selectableOrderIdsOnPage();
    return (
      selectableIds.length > 0 &&
      selectableIds.every((orderId) => this.isSelected(orderId))
    );
  }

  protected toggleSelectAllOnPage(checked: boolean) {
    const selectableIds = this.selectableOrderIdsOnPage();
    const current = new Set(this.selectedOrderIds());

    for (const orderId of selectableIds) {
      if (checked) {
        current.add(orderId);
      } else {
        current.delete(orderId);
      }
    }

    this.selectedOrderIds.set(Array.from(current).sort((a, b) => a - b));
    this.actionSuccess.set('');
  }

  protected clearSelection() {
    this.resetSelectionState();
    this.actionSuccess.set('');
  }

  protected selectedCount(): number {
    return this.selectedOrderIds().length;
  }

  protected canRunDryRun(): boolean {
    return this.selectedCount() > 0 && !this.actionLoading();
  }

  protected canApplyReviewed(): boolean {
    return (
      this.selectedCount() > 0 &&
      !this.actionLoading() &&
      !this.selectionChangedSinceReview() &&
      this.reviewedSelectionKey() === this.selectionKey(this.selectedOrderIds()) &&
      this.hasPlannedResults()
    );
  }

  protected selectionChangedSinceReview(): boolean {
    return (
      !!this.reviewedSelectionKey() &&
      this.reviewedSelectionKey() !== this.selectionKey(this.selectedOrderIds())
    );
  }

  protected runDryRun() {
    if (!this.canRunDryRun()) return;
    this.runBackfill(true);
  }

  protected requestApply() {
    if (!this.canApplyReviewed()) return;
    this.applyDialog()?.show();
  }

  protected onApplyConfirmed() {
    if (!this.canApplyReviewed()) return;
    this.runBackfill(false);
  }

  protected reconciliationStateLabel(
    state: InventoryReconciliationState,
  ): string {
    return RECONCILIATION_STATE_LABELS[state];
  }

  protected resultStatusBadge(
    status: InventoryReconciliationResultStatus,
  ): 'PLANNED' | 'APPLIED' | 'SKIPPED' | 'FAILED' {
    return RESULT_STATUS_BADGES[status];
  }

  protected resultStatusLabel(status: InventoryReconciliationResultStatus): string {
    return RESULT_STATUS_LABELS[status];
  }

  protected actionLabel(action: InventoryReconciliationAction): string {
    return formatLabel(action);
  }

  protected issueChipClass(issue: InventoryReconciliationIssue): string {
    return issue.autoFixable
      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
      : 'bg-red-50 text-red-700 ring-1 ring-red-200';
  }

  protected reviewBadgeClass(
    tone: 'auto' | 'manual' | 'stock',
  ): string {
    if (tone === 'auto') {
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    }
    if (tone === 'stock') {
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    }
    return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  }

  protected commitEvidenceLabel(row: InventoryReconciliationOrderRow): string {
    if (row.commitEvidence.length === 0) {
      return 'No commit evidence recorded.';
    }

    return row.commitEvidence.join(', ');
  }

  private runBackfill(dryRun: boolean) {
    const orderIds = [...this.selectedOrderIds()].sort((a, b) => a - b);
    if (orderIds.length === 0) return;

    this.actionLoading.set(true);
    this.actionMode.set(dryRun ? 'dryRun' : 'apply');
    this.actionError.set('');
    this.actionSuccess.set('');

    this.inventoryService.runReconciliationBackfill(orderIds, dryRun).subscribe({
      next: (res) => {
        this.lastBackfill.set(res.data);
        this.actionLoading.set(false);
        this.actionMode.set(null);

        if (dryRun) {
          this.reviewedSelectionKey.set(this.selectionKey(orderIds));
          this.actionSuccess.set(
            res.data.summary.plannedOrders > 0
              ? 'Dry run completed. Review the planned actions before applying.'
              : 'Dry run completed. No safe backfill actions were planned for this selection.',
          );
          return;
        }

        this.resetSelectionState();
        this.actionSuccess.set(
          res.data.summary.appliedOrders > 0
            ? 'Backfill applied. The reconciliation report has been refreshed.'
            : 'Apply completed. No history rows were written for the reviewed selection.',
        );
        this.loadReport();
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.actionError.set(
          errorBody.message ?? 'Failed to run reconciliation backfill.',
        );
        this.actionLoading.set(false);
        this.actionMode.set(null);
      },
    });
  }

  private hasPlannedResults(): boolean {
    const lastBackfill = this.lastBackfill();
    if (!lastBackfill || !lastBackfill.dryRun) return false;

    return lastBackfill.results.some((result) => result.status === 'planned');
  }

  private resetSelectionState() {
    this.selectedOrderIds.set([]);
    this.reviewedSelectionKey.set('');
  }

  private selectionKey(orderIds: readonly number[]): string {
    return [...orderIds].sort((a, b) => a - b).join(',');
  }
}
