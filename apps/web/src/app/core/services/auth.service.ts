import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, switchMap, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User, AuthResponse, MeResponse } from '../../shared/models/user.model';
import type { ApiResponse } from '../../shared/models/api-response.model';

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private readonly currentUser = signal<User | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly _restoring = signal(false);

  private static readonly SESSION_TOKEN_KEY = 'pc_hub_at';

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly restoring = this._restoring.asReadonly();

  constructor() {
    this.restoreSession();
  }

  register(payload: RegisterPayload) {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/register`, payload, {
        withCredentials: true,
      })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  login(payload: LoginPayload) {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/auth/login`, payload, {
        withCredentials: true,
      })
      .pipe(tap((res) => this.handleAuthResponse(res)));
  }

  refresh() {
    return this.http
      .post<
        ApiResponse<{ accessToken: string }>
      >(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.setToken(res.data.accessToken);
        }),
        switchMap(() => this.fetchMe()),
      );
  }

  logout() {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => EMPTY),
      tap(() => this.clearSession()),
    );
  }

  fetchMe() {
    return this.http.get<MeResponse>(`${this.apiUrl}/auth/me`).pipe(
      tap((res) => this.currentUser.set(res.data)),
      catchError(() => {
        this.clearSession();
        return EMPTY;
      }),
    );
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  clearSession() {
    this.currentUser.set(null);
    this.accessToken.set(null);
    try { sessionStorage.removeItem(AuthService.SESSION_TOKEN_KEY); } catch { /* SSR/private browsing */ }
  }

  private setToken(token: string) {
    this.accessToken.set(token);
    try { sessionStorage.setItem(AuthService.SESSION_TOKEN_KEY, token); } catch { /* SSR/private browsing */ }
  }

  private handleAuthResponse(res: AuthResponse) {
    this.currentUser.set(res.data.user);
    this.setToken(res.data.accessToken);
  }

  private restoreSession() {
    // Session restoration strategy:
    // 1. Check sessionStorage for an access token (survives page refresh within same tab)
    //    → If found, set it and validate with GET /auth/me (not rate-limited)
    // 2. If no token in sessionStorage (new tab), call POST /auth/refresh using httpOnly cookie
    // This avoids hitting the refresh endpoint on every page reload.
    this._restoring.set(true);

    let cachedToken: string | null = null;
    try { cachedToken = sessionStorage.getItem(AuthService.SESSION_TOKEN_KEY); } catch { /* SSR/private browsing */ }

    queueMicrotask(() => {
      if (cachedToken) {
        // Path A: token in sessionStorage → validate with fetchMe
        this.accessToken.set(cachedToken);
        this.fetchMe()
          .subscribe({
            complete: () => this._restoring.set(false),
            error: () => this._restoring.set(false),
          });
      } else {
        // Path B: no cached token → use refresh cookie
        this.http
          .post<
            ApiResponse<{ accessToken: string }>
          >(`${this.apiUrl}/auth/refresh`, {}, { withCredentials: true })
          .pipe(
            tap((res) => {
              this.setToken(res.data.accessToken);
            }),
            switchMap(() => this.fetchMe()),
            catchError(() => {
              this.clearSession();
              return EMPTY;
            }),
          )
          .subscribe({
            complete: () => this._restoring.set(false),
            error: () => this._restoring.set(false),
          });
      }
    });
  }
}
