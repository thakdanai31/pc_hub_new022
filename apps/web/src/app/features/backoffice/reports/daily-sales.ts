import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  BackofficeReportService,
  type DailySalesResult,
} from '../../../core/services/backoffice-report.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'app-bo-daily-sales',
  imports: [FormsModule, DatePipe, ThaiBahtPipe, PageHeader, AlertBanner, StatusBadge],
  templateUrl: './daily-sales.html',
})
export class BoDailySalesPage implements OnInit {
  private readonly reportService = inject(BackofficeReportService);

  protected readonly sales = signal<DailySalesResult | null>(null);
  protected readonly loading = signal(true);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected selectedDate = '';

  ngOnInit() {
    this.loadSales();
  }

  onDateChange() {
    this.loadSales();
  }

  onExportExcel() {
    this.exporting.set(true);
    this.reportService.downloadExcel(this.selectedDate || undefined).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `daily-sales-${this.selectedDate || 'today'}.xlsx`);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }

  onExportPdf() {
    this.exporting.set(true);
    this.reportService.downloadPdf(this.selectedDate || undefined).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `daily-sales-${this.selectedDate || 'today'}.pdf`);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }

  private loadSales() {
    this.loading.set(true);
    this.error.set('');
    this.reportService.getDailySales(this.selectedDate || undefined).subscribe({
      next: (res) => {
        this.sales.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load daily sales data.');
        this.loading.set(false);
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
