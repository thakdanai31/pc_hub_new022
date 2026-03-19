import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';

export interface AdminUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'STAFF' | 'ADMIN';
}

export interface CreateUserBody {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BackofficeUserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listUsers(params: UserListParams = {}) {
    const q: Record<string, string> = {};
    if (params.page) q['page'] = String(params.page);
    if (params.limit) q['limit'] = String(params.limit);
    if (params.search) q['search'] = params.search;
    if (params.role) q['role'] = params.role;

    return this.http.get<PaginatedApiResponse<AdminUser>>(
      `${this.apiUrl}/backoffice/users`,
      { params: q },
    );
  }

  createUser(role: 'staff' | 'admin', body: CreateUserBody) {
    return this.http.post<ApiResponse<AdminUser>>(
      `${this.apiUrl}/backoffice/users/${role}`,
      body,
    );
  }

  updateUser(userId: number, body: UpdateUserBody) {
    return this.http.patch<ApiResponse<AdminUser>>(
      `${this.apiUrl}/backoffice/users/${userId}`,
      body,
    );
  }

  disableUser(userId: number) {
    return this.http.post<ApiResponse<AdminUser>>(
      `${this.apiUrl}/backoffice/users/${userId}/disable`,
      {},
    );
  }
}
