import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackofficeOrderService, type BackofficeOrderDetail } from '../../../core/services/backoffice-order.service';
import { ThaiBahtPipe } from '../../../shared/pipes/thai-baht.pipe';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-bo-order-detail',
  imports: [RouterLink, DatePipe, FormsModule, ThaiBahtPipe, StatusBadge, AlertBanner],
  templateUrl: './order-detail.html',
})
export class BoOrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(BackofficeOrderService);

  protected readonly order = signal<BackofficeOrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly actionLoading = signal(false);
  protected readonly showRejectForm = signal(false);
  protected readonly errorMsg = signal('');
  protected rejectReason = '';

  protected readonly orderTimeline = [
    { status: 'PENDING', label: 'Order Placed' },
    { status: 'PAYMENT_REVIEW', label: 'Payment Review' },
    { status: 'APPROVED', label: 'Approved' },
    { status: 'PROCESSING', label: 'Processing' },
    { status: 'SHIPPED', label: 'Shipped' },
    { status: 'DELIVERED', label: 'Delivered' },
  ];

  private readonly statusOrder = ['PENDING', 'AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAYMENT_REVIEW', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('orderId'));
    if (!id) return;

    this.orderService.getOrder(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected canApprove(): boolean {
    const o = this.order();
    if (!o) return false;
    return (
      (o.paymentMethod === 'COD' && o.status === 'PENDING') ||
      (o.paymentMethod === 'PROMPTPAY_QR' && o.status === 'PAYMENT_REVIEW')
    );
  }

  protected canAdvance(): boolean {
    const o = this.order();
    if (!o) return false;
    return ['APPROVED', 'PROCESSING', 'SHIPPED'].includes(o.status);
  }

  protected addressEntries(): [string, string][] {
    const snap = this.order()?.addressSnapshot;
    if (!snap) return [];
    return Object.entries(snap);
  }

  protected getProductName(snapshot: Record<string, unknown>): string {
    return typeof snapshot['name'] === 'string' ? snapshot['name'] : 'Unknown Product';
  }

  protected getProductSku(snapshot: Record<string, unknown>): string {
    return typeof snapshot['sku'] === 'string' ? snapshot['sku'] : '';
  }

  protected isTimelineStepDone(stepStatus: string, currentStatus: string): boolean {
    const stepIdx = this.statusOrder.indexOf(stepStatus);
    const currentIdx = this.statusOrder.indexOf(currentStatus);
    if (stepIdx === -1 || currentIdx === -1) return false;
    return stepIdx < currentIdx;
  }

  protected isTimelineStepCurrent(stepStatus: string, currentStatus: string): boolean {
    return stepStatus === currentStatus;
  }

  protected getTimelineStepClass(stepStatus: string, currentStatus: string): string {
    if (this.isTimelineStepCurrent(stepStatus, currentStatus)) {
      return 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500/30';
    }
    if (this.isTimelineStepDone(stepStatus, currentStatus)) {
      return 'bg-indigo-100 text-indigo-600';
    }
    return 'bg-slate-100 text-slate-400';
  }

  onApprove() {
    const o = this.order();
    if (!o) return;
    this.actionLoading.set(true);
    this.errorMsg.set('');
    this.orderService.approveOrder(o.id).subscribe({
      next: () => this.reloadOrder(o.id),
      error: (err) => {
        this.errorMsg.set(err.error?.message ?? 'Failed to approve');
        this.actionLoading.set(false);
      },
    });
  }

  onReject() {
    const o = this.order();
    if (!o || !this.rejectReason.trim()) return;
    this.actionLoading.set(true);
    this.errorMsg.set('');
    this.orderService.rejectOrder(o.id, this.rejectReason.trim()).subscribe({
      next: () => this.reloadOrder(o.id),
      error: (err) => {
        this.errorMsg.set(err.error?.message ?? 'Failed to reject');
        this.actionLoading.set(false);
      },
    });
  }

  onAdvance(status: string) {
    const o = this.order();
    if (!o) return;
    this.actionLoading.set(true);
    this.errorMsg.set('');
    this.orderService.advanceStatus(o.id, status).subscribe({
      next: () => this.reloadOrder(o.id),
      error: (err) => {
        this.errorMsg.set(err.error?.message ?? 'Failed to advance status');
        this.actionLoading.set(false);
      },
    });
  }

  private reloadOrder(id: number) {
    this.orderService.getOrder(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.actionLoading.set(false);
        this.showRejectForm.set(false);
        this.rejectReason = '';
      },
      error: () => this.actionLoading.set(false),
    });
  }

}
