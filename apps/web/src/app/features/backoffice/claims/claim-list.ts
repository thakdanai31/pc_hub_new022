import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BackofficeClaimService,
  type BackofficeClaimRecord,
  type ClaimStatus,
} from '../../../core/services/backoffice-claim.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

const CLAIM_STATUS_TABS: { labelKey: string; value: ClaimStatus | '' }[] = [
  { labelKey: 'common.all', value: '' },
  { labelKey: 'enum.PENDING', value: 'PENDING' },
  { labelKey: 'enum.IN_REVIEW', value: 'IN_REVIEW' },
  { labelKey: 'enum.SENT_TO_MANUFACTURER', value: 'SENT_TO_MANUFACTURER' },
  { labelKey: 'enum.COMPLETED', value: 'COMPLETED' },
  { labelKey: 'enum.REJECTED', value: 'REJECTED' },
];

@Component({
  selector: 'app-bo-claim-list',
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
  templateUrl: './claim-list.html',
})
export class BoClaimListPage implements OnInit {
  private readonly claimService = inject(BackofficeClaimService);
  protected readonly language = inject(LanguageService);

  protected readonly claims = signal<BackofficeClaimRecord[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected search = '';
  protected statusFilter: ClaimStatus | '' = '';
  protected readonly statusTabs = CLAIM_STATUS_TABS;
  private currentPage = 1;

  ngOnInit() {
    this.loadClaims();
  }

  protected onFilterChange() {
    this.currentPage = 1;
    this.loadClaims();
  }

  protected onStatusTab(value: ClaimStatus | '') {
    this.statusFilter = value;
    this.onFilterChange();
  }

  protected hasActiveFilters(): boolean {
    return !!(this.search || this.statusFilter);
  }

  protected clearFilters() {
    this.search = '';
    this.statusFilter = '';
    this.onFilterChange();
  }

  protected goToPage(page: number) {
    this.currentPage = page;
    this.loadClaims();
  }

  protected loadClaims() {
    this.loading.set(true);
    this.error.set('');
    this.claimService
      .listClaims({
        page: this.currentPage,
        limit: 20,
        status: this.statusFilter || undefined,
        search: this.search.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.claims.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.language.translate('backoffice.claims.loadError'));
          this.loading.set(false);
        },
      });
  }
}
