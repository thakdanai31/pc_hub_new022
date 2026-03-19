import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';

export interface ProfileData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getProfile() {
    return this.http.get<ApiResponse<ProfileData>>(`${this.apiUrl}/account/profile`);
  }

  updateProfile(payload: UpdateProfilePayload) {
    return this.http.patch<ApiResponse<ProfileData>>(`${this.apiUrl}/account/profile`, payload);
  }
}
