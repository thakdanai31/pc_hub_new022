import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BackofficeReportService, type DailySalesResult } from '../../../core/services/backoffice-report.service';
import { BackofficeAnalyticsService, type AnalyticsSummary, type RevenueTrendPoint, type TopProduct, type LowStockProduct, type RecentOrder } from '../../../core/services/backoffice-analytics.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-page',
  imports: [ThaiBahtPipe, AlertBanner, StatusBadge, RouterLink],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly reportService = inject(BackofficeReportService);
  private readonly analyticsService = inject(BackofficeAnalyticsService);

  protected readonly dailySales = signal<DailySalesResult | null>(null);
  protected readonly analyticsSummary = signal<AnalyticsSummary | null>(null);
  protected readonly revenueTrend = signal<RevenueTrendPoint[]>([]);
  protected readonly topProducts = signal<TopProduct[]>([]);
  protected readonly lowStockProducts = signal<LowStockProduct[]>([]);
  protected readonly recentOrders = signal<RecentOrder[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly trendMaxRevenue = computed(() => {
    const points = this.revenueTrend();
    if (points.length === 0) return 1;
    return Math.max(...points.map((p) => p.revenue), 1);
  });

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
          this.error.set('Failed to load daily sales data.');
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
      }).subscribe({
        next: (res) => {
          this.analyticsSummary.set(res.summary.data);
          this.revenueTrend.set(res.trend.data);
          this.topProducts.set(res.topProducts.data);
          this.lowStockProducts.set(res.lowStock.data);
          this.recentOrders.set(res.recentOrders.data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load analytics data.');
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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  protected formatDateTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected relativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  protected stockLevelClass(stock: number): string {
    if (stock === 0) return 'text-red-600 bg-red-50';
    if (stock <= 5) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-100';
  }
}
