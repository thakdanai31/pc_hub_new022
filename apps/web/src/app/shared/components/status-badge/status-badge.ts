import { Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';

const STATUS_STYLES: Record<string, string> = {
  // Order statuses
  PENDING:
    'bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 font-semibold ring-1 ring-amber-600/30 shadow-sm',
  AWAITING_PAYMENT:
    'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold ring-1 ring-blue-600/30 shadow-sm',
  PAYMENT_REVIEW:
    'bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-700 font-semibold ring-1 ring-purple-600/30 shadow-sm',
  APPROVED:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  IN_REVIEW:
    'bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-700 font-semibold ring-1 ring-sky-600/30 shadow-sm',
  PROCESSING:
    'bg-gradient-to-r from-cyan-50 to-cyan-100/50 text-cyan-700 font-semibold ring-1 ring-cyan-600/30 shadow-sm',
  SENT_TO_MANUFACTURER:
    'bg-gradient-to-r from-violet-50 to-violet-100/50 text-violet-700 font-semibold ring-1 ring-violet-600/30 shadow-sm',
  SHIPPED:
    'bg-gradient-to-r from-indigo-50 to-indigo-100/50 text-indigo-700 font-semibold ring-1 ring-indigo-600/30 shadow-sm',
  DELIVERED:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  COMPLETED:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  COMMITTED:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  COMMITTED_CANCELLED:
    'bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 font-semibold ring-1 ring-amber-600/30 shadow-sm',
  NOT_COMMITTED:
    'bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 font-medium ring-1 ring-slate-300/50',
  AMBIGUOUS_CANCELLED:
    'bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 font-semibold ring-1 ring-red-600/30 shadow-sm',
  PLANNED:
    'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold ring-1 ring-blue-600/30 shadow-sm',
  APPLIED:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  SKIPPED:
    'bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 font-medium ring-1 ring-slate-300/50',
  FAILED:
    'bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 font-semibold ring-1 ring-red-600/30 shadow-sm',
  RESTOCK:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  SALE:
    'bg-gradient-to-r from-rose-50 to-rose-100/50 text-rose-700 font-semibold ring-1 ring-rose-600/30 shadow-sm',
  ADJUSTMENT_IN:
    'bg-gradient-to-r from-sky-50 to-sky-100/50 text-sky-700 font-semibold ring-1 ring-sky-600/30 shadow-sm',
  ADJUSTMENT_OUT:
    'bg-gradient-to-r from-orange-50 to-orange-100/50 text-orange-700 font-semibold ring-1 ring-orange-600/30 shadow-sm',
  RETURN_IN:
    'bg-gradient-to-r from-teal-50 to-teal-100/50 text-teal-700 font-semibold ring-1 ring-teal-600/30 shadow-sm',
  RETURN_OUT:
    'bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 font-semibold ring-1 ring-red-600/30 shadow-sm',
  REJECTED:
    'bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 font-semibold ring-1 ring-red-600/30 shadow-sm',
  CANCELLED:
    'bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 font-medium ring-1 ring-slate-300/50',

  // Generic / toggleable statuses
  ACTIVE:
    'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 font-semibold ring-1 ring-emerald-600/30 shadow-sm',
  INACTIVE:
    'bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 font-medium ring-1 ring-slate-300/50',

  // Payment methods
  COD: 'bg-gradient-to-r from-amber-50 to-amber-100/50 text-amber-700 font-semibold ring-1 ring-amber-600/30 shadow-sm',
  PROMPTPAY_QR:
    'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold ring-1 ring-blue-600/30 shadow-sm',

  // Roles
  ADMIN:
    'bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-700 font-semibold ring-1 ring-purple-600/30 shadow-sm',
  STAFF:
    'bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 font-semibold ring-1 ring-blue-600/30 shadow-sm',
  CUSTOMER:
    'bg-gradient-to-r from-slate-100 to-slate-200/50 text-slate-600 font-medium ring-1 ring-slate-300/50',
};

const FALLBACK_STYLE = 'bg-slate-100 text-slate-600 ring-slate-500/10';

function formatLabel(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  private readonly language = inject(LanguageService);

  readonly status = input.required<string>();
  readonly label = input<string>();

  readonly displayLabel = computed(
    () =>
      this.label() ??
      this.language.enumLabel(this.status()) ??
      formatLabel(this.status()),
  );
  readonly badgeClasses = computed(() => STATUS_STYLES[this.status()] ?? FALLBACK_STYLE);
}
