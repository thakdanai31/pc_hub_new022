import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';

export type ClaimStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'SENT_TO_MANUFACTURER'
  | 'COMPLETED'
  | 'REJECTED';

export interface CustomerClaimRecord {
  id: number;
  userId: number;
  orderId: number;
  productId: number;
  issueDescription: string;
  status: ClaimStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: number;
    orderNumber: string;
    status: string;
    createdAt: string;
  };
  product: {
    id: number;
    name: string;
    slug: string;
    sku: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ClaimService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getClaims(page = 1, limit = 10, status?: ClaimStatus) {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (status) {
      params['status'] = status;
    }

    return this.http.get<PaginatedApiResponse<CustomerClaimRecord>>(
      `${this.apiUrl}/account/claims`,
      { params },
    );
  }

  getClaim(claimId: number) {
    return this.http.get<ApiResponse<CustomerClaimRecord>>(
      `${this.apiUrl}/account/claims/${claimId}`,
    );
  }

  createClaim(body: {
    orderId: number;
    productId: number;
    issueDescription: string;
  }) {
    return this.http.post<ApiResponse<CustomerClaimRecord>>(
      `${this.apiUrl}/account/claims`,
      body,
    );
  }
}
