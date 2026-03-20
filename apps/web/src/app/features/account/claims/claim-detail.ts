import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ClaimService,
  type CustomerClaimRecord,
} from '../../../core/services/claim.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-claim-detail',
  imports: [RouterLink, DatePipe, AlertBanner, StatusBadge, TranslatePipe],
  templateUrl: './claim-detail.html',
})
export class ClaimDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly claimService = inject(ClaimService);
  protected readonly language = inject(LanguageService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly claim = signal<CustomerClaimRecord | null>(null);

  ngOnInit() {
    const claimId = Number(this.route.snapshot.paramMap.get('claimId'));
    if (!claimId) {
      this.error.set(this.language.translate('storefront.claims.detail.notFound'));
      this.loading.set(false);
      return;
    }

    this.loadClaim(claimId);
  }

  private loadClaim(claimId: number) {
    this.loading.set(true);
    this.error.set('');

    this.claimService.getClaim(claimId).subscribe({
      next: (res) => {
        this.claim.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.error.set(
          errorBody.message ?? this.language.translate('storefront.claims.detail.loadError'),
        );
        this.loading.set(false);
      },
    });
  }
}
