import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ClaimService,
  type ClaimStatus,
  type CustomerClaimRecord,
} from '../../../core/services/claim.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-claim-history',
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
  templateUrl: './claim-history.html',
})
export class ClaimHistoryPage implements OnInit {
  private readonly claimService = inject(ClaimService);
  protected readonly language = inject(LanguageService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly claims = signal<CustomerClaimRecord[]>([]);
  readonly pagination = signal<PaginationMeta | null>(null);
  readonly statusFilter = signal<ClaimStatus | ''>('');
  private currentPage = 1;

  ngOnInit() {
    this.loadClaims();
  }

  onFilterChange(status: ClaimStatus | '') {
    this.statusFilter.set(status);
    this.currentPage = 1;
    this.loadClaims();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadClaims();
  }

  previewIssue(description: string): string {
    if (description.length <= 100) {
      return description;
    }
    return `${description.slice(0, 100)}...`;
  }

  private loadClaims() {
    this.loading.set(true);
    this.error.set('');

    const status = this.statusFilter();
    this.claimService
      .getClaims(this.currentPage, 10, status || undefined)
      .subscribe({
        next: (res) => {
          this.claims.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.language.translate('storefront.claims.history.loadError'));
          this.loading.set(false);
        },
      });
  }
}
