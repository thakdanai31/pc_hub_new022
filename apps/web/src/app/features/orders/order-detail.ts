import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { OrderService } from '../../core/services/order.service';
import { ThaiBahtPipe } from '../../shared/pipes/thai-baht.pipe';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { AlertBanner } from '../../shared/components/alert-banner/alert-banner';
import type { OrderDetail, PromptPayQR } from '../../shared/models/order.model';

@Component({
  selector: 'app-order-detail',
  imports: [RouterLink, DatePipe, ThaiBahtPipe, StatusBadge, AlertBanner],
  templateUrl: './order-detail.html',
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly orderService = inject(OrderService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<OrderDetail | null>(null);

  readonly qrLoading = signal(false);
  readonly qrData = signal<PromptPayQR | null>(null);
  readonly qrError = signal('');

  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal(false);

  ngOnInit() {
    const orderId = Number(this.route.snapshot.params['orderId']);
    if (!orderId || isNaN(orderId)) {
      this.error.set('Invalid order ID');
      this.loading.set(false);
      return;
    }
    this.loadOrder(orderId);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.uploadError.set('');
    this.uploadSuccess.set(false);
  }

  onUploadSlip() {
    const file = this.selectedFile();
    const o = this.order();
    if (!file || !o) return;

    this.uploading.set(true);
    this.uploadError.set('');

    this.orderService.uploadSlip(o.id, file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploadSuccess.set(true);
        this.selectedFile.set(null);
        // Reload order to reflect new status
        this.loadOrder(o.id);
      },
      error: () => {
        this.uploading.set(false);
        this.uploadError.set('Failed to upload slip. Please try again.');
      },
    });
  }

  private loadOrder(orderId: number) {
    this.loading.set(true);
    this.error.set('');

    this.orderService.getOrder(orderId).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);

        // Load QR if PromptPay and awaiting payment
        if (res.data.paymentMethod === 'PROMPTPAY_QR' && res.data.status === 'AWAITING_PAYMENT') {
          this.loadQR(orderId);
        }
      },
      error: () => {
        this.error.set('Order not found.');
        this.loading.set(false);
      },
    });
  }

  private loadQR(orderId: number) {
    this.qrLoading.set(true);
    this.orderService.getPromptPayQR(orderId).subscribe({
      next: (res) => {
        this.qrData.set(res.data);
        this.qrLoading.set(false);
      },
      error: () => {
        this.qrError.set('Failed to load QR code.');
        this.qrLoading.set(false);
      },
    });
  }
}
