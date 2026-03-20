import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClaimService, type CustomerClaimRecord } from '../../../core/services/claim.service';
import { LanguageService } from '../../../core/services/language.service';
import { OrderService } from '../../../core/services/order.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { OrderDetail, OrderItemDetail } from '../../../shared/models/order.model';

@Component({
  selector: 'app-claim-create',
  imports: [
    RouterLink,
    FormsModule,
    AlertBanner,
    StatusBadge,
    ThaiBahtPipe,
    TranslatePipe,
  ],
  templateUrl: './claim-create.html',
})
export class ClaimCreatePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);
  private readonly claimService = inject(ClaimService);
  protected readonly language = inject(LanguageService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly fieldError = signal('');
  readonly order = signal<OrderDetail | null>(null);
  readonly item = signal<OrderItemDetail | null>(null);
  readonly createdClaim = signal<CustomerClaimRecord | null>(null);

  issueDescription = '';
  private orderId = 0;
  private productId = 0;

  canSubmit(): boolean {
    return (
      !this.loading() &&
      !this.submitting() &&
      !this.createdClaim() &&
      !!this.item() &&
      this.order()?.status === 'DELIVERED' &&
      this.issueDescription.trim().length > 0
    );
  }

  ngOnInit() {
    this.orderId = Number(this.route.snapshot.queryParamMap.get('orderId'));
    this.productId = Number(this.route.snapshot.queryParamMap.get('productId'));

    if (!this.orderId || !this.productId) {
      this.error.set(
        this.language.translate('storefront.claims.create.missingInfo'),
      );
      this.loading.set(false);
      return;
    }

    this.loadOrder();
  }

  submitClaim() {
    if (!this.canSubmit()) {
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.fieldError.set('');

    this.claimService
      .createClaim({
        orderId: this.orderId,
        productId: this.productId,
        issueDescription: this.issueDescription.trim(),
      })
      .subscribe({
        next: (res) => {
          this.createdClaim.set(res.data);
          this.submitting.set(false);
        },
        error: (err) => {
          const errorBody = extractErrorBody(err.error);
          this.fieldError.set(errorBody.fieldErrors?.['issueDescription'] ?? '');
          this.error.set(
            errorBody.message ?? this.language.translate('storefront.claims.create.submitError'),
          );
          this.submitting.set(false);
        },
      });
  }

  private loadOrder() {
    this.loading.set(true);
    this.error.set('');

    this.orderService.getOrder(this.orderId).subscribe({
      next: (res) => {
        this.order.set(res.data);
        const matchedItem =
          res.data.items.find((item) => item.productId === this.productId) ?? null;
        this.item.set(matchedItem);

        if (!matchedItem) {
          this.error.set(
            this.language.translate('storefront.claims.create.productNotFound'),
          );
        } else if (res.data.status !== 'DELIVERED') {
          this.error.set(
            this.language.translate('storefront.claims.create.orderNotEligible'),
          );
        }

        this.loading.set(false);
      },
      error: (err) => {
        const errorBody = extractErrorBody(err.error);
        this.error.set(
          errorBody.message ??
            this.language.translate('storefront.claims.create.loadOrderError'),
        );
        this.loading.set(false);
      },
    });
  }
}
