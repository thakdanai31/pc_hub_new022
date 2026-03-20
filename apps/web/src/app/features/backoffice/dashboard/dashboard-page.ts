import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { BackofficeReportService, type DailySalesResult } from '../../../core/services/backoffice-report.service';
import { BackofficeAnalyticsService, type AnalyticsSummary, type RevenueTrendPoint, type TopProduct, type LowStockProduct, type RecentOrder } from '../../../core/services/backoffice-analytics.service';
import {
  BackofficeClaimService,
  type ClaimStatus,
} from '../../../core/services/backoffice-claim.service';
import {
  BackofficeInventoryService,
  type InventoryReconciliationReportSummary,
  type InventoryTransactionRecord,
  type InventoryTransactionType,
} from '../../../core/services/backoffice-inventory.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const STOCK_IN_TYPES = new Set<InventoryTransactionType>([
  'RESTOCK',
  'ADJUSTMENT_IN',
  'RETURN_IN',
]);

@Component({
  selector: 'app-dashboard-page',
  imports: [ThaiBahtPipe, AlertBanner, StatusBadge, RouterLink, TranslatePipe],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly reportService = inject(BackofficeReportService);
  private readonly analyticsService = inject(BackofficeAnalyticsService);
  private readonly claimService = inject(BackofficeClaimService);
  private readonly inventoryService = inject(BackofficeInventoryService);

  protected readonly dailySales = signal<DailySalesResult | null>(null);
  protected readonly analyticsSummary = signal<AnalyticsSummary | null>(null);
  protected readonly revenueTrend = signal<RevenueTrendPoint[]>([]);
  protected readonly topProducts = signal<TopProduct[]>([]);
  protected readonly lowStockProducts = signal<LowStockProduct[]>([]);
  protected readonly recentOrders = signal<RecentOrder[]>([]);
  protected readonly recentInventoryTransactions = signal<InventoryTransactionRecord[]>([]);
  protected readonly reconciliationSummary = signal<InventoryReconciliationReportSummary | null>(null);
  protected readonly pendingClaimsCount = signal(0);
  protected readonly inReviewClaimsCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly trendMaxRevenue = computed(() => {
    const points = this.revenueTrend();
    if (points.length === 0) return 1;
    return Math.max(...points.map((p) => p.revenue), 1);
  });
  protected readonly claimsNeedingReview = computed(
    () => this.pendingClaimsCount() + this.inReviewClaimsCount(),
  );

  ngOnInit() {
    this.loadData();
  }

  protected retry() {
    this.error.set('');
    this.loadData();
  }

  private loadData() {
    const role = this.auth.user()?.role;
    this.loading.set(true);

    if (role === 'STAFF') {
      this.reportService.getDailySales().subscribe({
        next: (res) => {
          this.dailySales.set(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.language.translate('backoffice.dashboard.loadStaffError'),
          );
          this.loading.set(false);
        },
      });
    } else if (role === 'ADMIN') {
      forkJoin({
        summary: this.analyticsService.getSummary(),
        trend: this.analyticsService.getRevenueTrend('30d'),
        topProducts: this.analyticsService.getTopProducts(5),
        lowStock: this.analyticsService.getLowStockProducts(10, 5),
        recentOrders: this.analyticsService.getRecentOrders(5),
        pendingClaims: this.claimService.listClaims({
          page: 1,
          limit: 1,
          status: 'PENDING',
        }),
        inReviewClaims: this.claimService.listClaims({
          page: 1,
          limit: 1,
          status: 'IN_REVIEW',
        }),
        reconciliation: this.inventoryService.getReconciliationReport({
          page: 1,
          limit: 1,
        }),
        recentInventory: this.inventoryService.listTransactions({
          page: 1,
          limit: 5,
        }),
      }).subscribe({
        next: (res) => {
          this.analyticsSummary.set(res.summary.data);
          this.revenueTrend.set(res.trend.data);
          this.topProducts.set(res.topProducts.data);
          this.lowStockProducts.set(res.lowStock.data);
          this.recentOrders.set(res.recentOrders.data);
          this.pendingClaimsCount.set(res.pendingClaims.pagination.total);
          this.inReviewClaimsCount.set(res.inReviewClaims.pagination.total);
          this.reconciliationSummary.set(res.reconciliation.data.summary);
          this.recentInventoryTransactions.set(res.recentInventory.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.language.translate('backoffice.dashboard.loadAdminError'),
          );
          this.loading.set(false);
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  protected isStaff(): boolean {
    return this.auth.user()?.role === 'STAFF';
  }

  protected isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  protected trendBarHeight(revenue: number): string {
    const max = this.trendMaxRevenue();
    const pct = max > 0 ? (revenue / max) * 100 : 0;
    return `${Math.max(pct, 4)}%`;
  }

  protected formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(this.language.locale(), {
      month: 'short',
      day: 'numeric',
    });
  }

  protected formatDateTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(this.language.locale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected relativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) {
      return this.language.translate('backoffice.dashboard.justNow');
    }
    if (mins < 60) {
      return this.language.translate('backoffice.dashboard.minutesAgo', {
        count: mins,
      });
    }
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) {
      return this.language.translate('backoffice.dashboard.hoursAgo', {
        count: hrs,
      });
    }
    const days = Math.floor(hrs / 24);
    return this.language.translate('backoffice.dashboard.daysAgo', {
      count: days,
    });
  }

  protected stockLevelClass(stock: number): string {
    if (stock === 0) return 'text-red-600 bg-red-50';
    if (stock <= 5) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-100';
  }

  protected inventoryQuantityClass(transaction: InventoryTransactionRecord): string {
    return STOCK_IN_TYPES.has(transaction.type)
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-rose-700 bg-rose-50';
  }

  protected inventoryQuantityLabel(transaction: InventoryTransactionRecord): string {
    const prefix = STOCK_IN_TYPES.has(transaction.type) ? '+' : '-';
    return `${prefix}${transaction.quantity}`;
  }

  protected claimStatusCount(status: ClaimStatus): number {
    return status === 'PENDING'
      ? this.pendingClaimsCount()
      : this.inReviewClaimsCount();
  }

  protected claimReviewAlertMessage(): string {
    return this.language.translate('backoffice.dashboard.claimReviewAlert', {
      count: this.claimsNeedingReview(),
    });
  }

  protected ordersAttentionAlertMessage(count: number): string {
    return this.language.translate(
      'backoffice.dashboard.ordersAttentionAlert',
      { count },
    );
  }

  protected lowStockAlertMessage(count: number): string {
    return this.language.translate('backoffice.dashboard.lowStockAlert', {
      count,
    });
  }

  protected reconciliationAlertMessage(count: number): string {
    return this.language.translate(
      'backoffice.dashboard.reconciliationAlert',
      { count },
    );
  }
}
