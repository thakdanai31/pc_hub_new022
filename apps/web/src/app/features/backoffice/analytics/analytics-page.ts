import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BackofficeAnalyticsService,
  type AnalyticsSummary,
  type RevenueTrendPoint,
  type TopProduct,
} from '../../../core/services/backoffice-analytics.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-bo-analytics',
  imports: [FormsModule, ThaiBahtPipe, PageHeader, AlertBanner, StatusBadge],
  templateUrl: './analytics-page.html',
})
export class BoAnalyticsPage implements OnInit {
  private readonly analyticsService = inject(BackofficeAnalyticsService);

  protected readonly summary = signal<AnalyticsSummary | null>(null);
  protected readonly trendData = signal<RevenueTrendPoint[]>([]);
  protected readonly topProducts = signal<TopProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly summaryError = signal('');
  protected readonly trendLoading = signal(false);
  protected readonly trendError = signal('');
  protected readonly topLoading = signal(false);
  protected readonly topError = signal('');

  protected trendPeriod: '7d' | '30d' | '90d' = '30d';
  protected topLimit = 10;

  ngOnInit() {
    this.loadSummary();
    this.loadTrend();
    this.loadTopProducts();
  }

  protected retrySummary() {
    this.summaryError.set('');
    this.loadSummary();
  }

  private loadSummary() {
    this.loading.set(true);
    this.analyticsService.getSummary().subscribe({
      next: (res) => {
        this.summary.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.summaryError.set('Failed to load analytics summary.');
        this.loading.set(false);
      },
    });
  }

  onTrendPeriodChange() {
    this.loadTrend();
  }

  onTopLimitChange() {
    this.loadTopProducts();
  }

  private loadTrend() {
    this.trendLoading.set(true);
    this.trendError.set('');
    this.analyticsService.getRevenueTrend(this.trendPeriod).subscribe({
      next: (res) => {
        this.trendData.set(res.data);
        this.trendLoading.set(false);
      },
      error: () => {
        this.trendError.set('Failed to load revenue trend.');
        this.trendLoading.set(false);
      },
    });
  }

  private loadTopProducts() {
    this.topLoading.set(true);
    this.topError.set('');
    this.analyticsService.getTopProducts(this.topLimit).subscribe({
      next: (res) => {
        this.topProducts.set(res.data);
        this.topLoading.set(false);
      },
      error: () => {
        this.topError.set('Failed to load top products.');
        this.topLoading.set(false);
      },
    });
  }
}
