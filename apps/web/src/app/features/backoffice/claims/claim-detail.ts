import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BackofficeClaimService,
  type BackofficeClaimRecord,
  type ClaimStatus,
} from '../../../core/services/backoffice-claim.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

const CLAIM_STATUS_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  PENDING: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['SENT_TO_MANUFACTURER', 'COMPLETED', 'REJECTED'],
  SENT_TO_MANUFACTURER: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
};

function formatClaimStatusLabel(status: ClaimStatus): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAdminNote(note: string | null | undefined): string {
  return note?.trim() ?? '';
}

@Component({
  selector: 'app-bo-claim-detail',
  imports: [RouterLink, DatePipe, FormsModule, AlertBanner, StatusBadge, TranslatePipe],
  templateUrl: './claim-detail.html',
})
export class BoClaimDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly claimService = inject(BackofficeClaimService);
  protected readonly language = inject(LanguageService);

  protected readonly claim = signal<BackofficeClaimRecord | null>(null);
  protected readonly loading = signal(true);
  protected readonly statusSaving = signal(false);
  protected readonly noteSaving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly successMsg = signal('');

  protected statusDraft: ClaimStatus | '' = '';
  protected adminNoteDraft = '';

  ngOnInit() {
    const claimId = Number(this.route.snapshot.paramMap.get('claimId'));
    if (!claimId) {
      this.errorMsg.set(this.language.translate('backoffice.claims.claimNotFound'));
      this.loading.set(false);
      return;
    }

    this.loadClaim(claimId);
  }

  protected availableStatusTransitions(): ClaimStatus[] {
    const claim = this.claim();
    if (!claim) return [];
    return CLAIM_STATUS_TRANSITIONS[claim.status];
  }

  protected statusLabel(status: ClaimStatus): string {
    return this.language.enumLabel(status) ?? formatClaimStatusLabel(status);
  }

  protected canSubmitStatus(): boolean {
    const claim = this.claim();
    if (!claim || !this.statusDraft || this.statusSaving()) return false;

    return (
      this.statusDraft !== claim.status &&
      this.availableStatusTransitions().includes(this.statusDraft)
    );
  }

  protected canSubmitAdminNote(): boolean {
    const claim = this.claim();
    if (!claim || this.noteSaving()) return false;

    return normalizeAdminNote(this.adminNoteDraft) !== normalizeAdminNote(claim.adminNote);
  }

  protected resetAdminNoteDraft() {
    this.adminNoteDraft = this.claim()?.adminNote ?? '';
  }

  protected onUpdateStatus() {
    const claim = this.claim();
    if (!claim || !this.canSubmitStatus()) return;
    const nextStatus = this.statusDraft as ClaimStatus;

    this.statusSaving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.claimService.updateClaimStatus(claim.id, nextStatus).subscribe({
      next: (res) => {
        this.applyClaim(res.data);
        this.successMsg.set(this.language.translate('backoffice.claims.statusUpdated'));
        this.statusSaving.set(false);
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.errorMsg.set(
          errorBody.message ??
            this.language.translate('backoffice.claims.updateStatusError'),
        );
        this.statusSaving.set(false);
      },
    });
  }

  protected onUpdateAdminNote() {
    const claim = this.claim();
    if (!claim || !this.canSubmitAdminNote()) return;

    this.noteSaving.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    const normalizedNote = normalizeAdminNote(this.adminNoteDraft);

    this.claimService
      .updateClaimAdminNote(claim.id, normalizedNote ? normalizedNote : null)
      .subscribe({
        next: (res) => {
          this.applyClaim(res.data);
          this.successMsg.set(
            this.language.translate('backoffice.claims.adminNoteUpdated'),
          );
          this.noteSaving.set(false);
        },
        error: (err) => {
          const errorBody = extractErrorBody(err.error);
          this.errorMsg.set(
            errorBody.message ??
              this.language.translate('backoffice.claims.updateNoteError'),
          );
          this.noteSaving.set(false);
        },
      });
  }

  private loadClaim(claimId: number) {
    this.loading.set(true);
    this.errorMsg.set('');
    this.claimService.getClaim(claimId).subscribe({
      next: (res) => {
        this.applyClaim(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.errorMsg.set(
          errorBody.message ?? this.language.translate('backoffice.claims.loadClaimError'),
        );
        this.loading.set(false);
      },
    });
  }

  private applyClaim(claim: BackofficeClaimRecord) {
    this.claim.set(claim);
    this.adminNoteDraft = claim.adminNote ?? '';
    this.statusDraft = this.availableStatusTransitions()[0] ?? claim.status;
  }
}
