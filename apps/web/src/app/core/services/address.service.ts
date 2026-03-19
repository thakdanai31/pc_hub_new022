import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Address, CreateAddressPayload, UpdateAddressPayload } from '../../shared/models/address.model';
import type { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/account/addresses`;

  list() {
    return this.http.get<ApiResponse<Address[]>>(this.apiUrl);
  }

  create(payload: CreateAddressPayload) {
    return this.http.post<ApiResponse<Address>>(this.apiUrl, payload);
  }

  update(addressId: number, payload: UpdateAddressPayload) {
    return this.http.patch<ApiResponse<Address>>(
      `${this.apiUrl}/${addressId}`,
      payload,
    );
  }

  delete(addressId: number) {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${addressId}`);
  }

  setDefault(addressId: number) {
    return this.http.post<ApiResponse<Address>>(
      `${this.apiUrl}/${addressId}/default`,
      {},
    );
  }
}
