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

export interface BackofficeClaimRecord {
  id: number;
  userId: number;
  orderId: number;
  productId: number;
  issueDescription: string;
  status: ClaimStatus;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
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

export interface ClaimListParams {
  page?: number;
  limit?: number;
  status?: ClaimStatus;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class BackofficeClaimService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listClaims(params: ClaimListParams = {}) {
    const queryParams: Record<string, string> = {};
    if (params.page) queryParams['page'] = String(params.page);
    if (params.limit) queryParams['limit'] = String(params.limit);
    if (params.status) queryParams['status'] = params.status;
    if (params.search) queryParams['search'] = params.search;

    return this.http.get<PaginatedApiResponse<BackofficeClaimRecord>>(
      `${this.apiUrl}/backoffice/claims`,
      { params: queryParams },
    );
  }

  getClaim(claimId: number) {
    return this.http.get<ApiResponse<BackofficeClaimRecord>>(
      `${this.apiUrl}/backoffice/claims/${claimId}`,
    );
  }

  updateClaimStatus(claimId: number, status: ClaimStatus) {
    return this.http.patch<ApiResponse<BackofficeClaimRecord>>(
      `${this.apiUrl}/backoffice/claims/${claimId}/status`,
      { status },
    );
  }

  updateClaimAdminNote(claimId: number, adminNote: string | null) {
    return this.http.patch<ApiResponse<BackofficeClaimRecord>>(
      `${this.apiUrl}/backoffice/claims/${claimId}/admin-note`,
      { adminNote },
    );
  }
}
