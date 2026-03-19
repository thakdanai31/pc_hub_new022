import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AddressService } from '../../../core/services/address.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import type { Address } from '../../../shared/models/address.model';

@Component({
  selector: 'app-address-list',
  imports: [RouterLink, EmptyState, ConfirmDialog],
  templateUrl: './address-list.html',
})
export class AddressList implements OnInit {
  private readonly addressService = inject(AddressService);

  readonly deleteDialog = viewChild<ConfirmDialog>('deleteDialog');

  readonly addresses = signal<Address[]>([]);
  readonly loading = signal(true);

  private pendingDeleteId: number | null = null;

  ngOnInit() {
    this.loadAddresses();
  }

  onSetDefault(addressId: number) {
    this.addressService.setDefault(addressId).subscribe(() => {
      this.loadAddresses();
    });
  }

  confirmDelete(addressId: number) {
    this.pendingDeleteId = addressId;
    this.deleteDialog()?.show();
  }

  onDeleteConfirmed() {
    if (this.pendingDeleteId === null) return;
    this.addressService.delete(this.pendingDeleteId).subscribe(() => {
      this.pendingDeleteId = null;
      this.loadAddresses();
    });
  }

  private loadAddresses() {
    this.loading.set(true);
    this.addressService.list().subscribe((res) => {
      this.addresses.set(res.data);
      this.loading.set(false);
    });
  }
}
