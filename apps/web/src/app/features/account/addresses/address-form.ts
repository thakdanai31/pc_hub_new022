import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AddressService } from '../../../core/services/address.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import type { CreateAddressPayload } from '../../../shared/models/address.model';

@Component({
  selector: 'app-address-form',
  imports: [FormsModule, AlertBanner],
  templateUrl: './address-form.html',
})
export class AddressForm implements OnInit {
  private readonly addressService = inject(AddressService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isEdit = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly serverFieldErrors = signal<Record<string, string>>({});
  submitted = false;

  form: CreateAddressPayload & { line2: string } = {
    label: '',
    recipientName: '',
    phoneNumber: '',
    line1: '',
    line2: '',
    district: '',
    subdistrict: '',
    province: '',
    postalCode: '',
    isDefault: false,
  };

  private addressId: number | null = null;

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('addressId');
    if (idParam) {
      this.addressId = Number(idParam);
      this.isEdit.set(true);
      this.loadAddress();
    }
  }

  onSubmit(form: { valid?: boolean | null }) {
    this.submitted = true;
    if (!form.valid) return;

    this.saving.set(true);
    this.errorMessage.set('');
    this.serverFieldErrors.set({});

    const payload: CreateAddressPayload = {
      ...this.form,
      line2: this.form.line2 || undefined,
    };

    const request$ = this.isEdit()
      ? this.addressService.update(this.addressId!, payload)
      : this.addressService.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/account/addresses']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const body = extractErrorBody(err.error);
        if (body.fieldErrors) {
          this.serverFieldErrors.set(body.fieldErrors);
          this.errorMessage.set('Please fix the errors below.');
        } else {
          this.errorMessage.set(body.message ?? 'Something went wrong.');
        }
      },
    });
  }

  onCancel() {
    void this.router.navigate(['/account/addresses']);
  }

  private loadAddress() {
    this.addressService.list().subscribe((res) => {
      const addr = res.data.find((a) => a.id === this.addressId);
      if (addr) {
        this.form = {
          label: addr.label,
          recipientName: addr.recipientName,
          phoneNumber: addr.phoneNumber,
          line1: addr.line1,
          line2: addr.line2 ?? '',
          district: addr.district,
          subdistrict: addr.subdistrict,
          province: addr.province,
          postalCode: addr.postalCode,
          isDefault: addr.isDefault,
        };
      }
    });
  }
}
