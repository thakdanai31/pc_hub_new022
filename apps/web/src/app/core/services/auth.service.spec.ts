import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import type { AuthResponse, MeResponse } from '../../shared/models/user.model';
import type { ApiResponse } from '../../shared/models/api-response.model';

const MOCK_USER = {
  id: 1,
  email: 'test@test.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'CUSTOMER' as const,
  isActive: true,
};

const MOCK_AUTH_RESPONSE: AuthResponse = {
  success: true,
  data: {
    user: MOCK_USER,
    accessToken: 'mock-access-token',
  },
};

const MOCK_REFRESH_RESPONSE: ApiResponse<{ accessToken: string }> = {
  success: true,
  data: { accessToken: 'refreshed-access-token' },
};

const MOCK_ME_RESPONSE: MeResponse = {
  success: true,
  data: MOCK_USER,
};

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);

    // The constructor calls restoreSession via queueMicrotask — flush the microtask queue
    await Promise.resolve();

    // Fail the startup refresh so the service starts in a clean logged-out state
    const restoreReq = httpTesting.match((r) => r.url.includes('/auth/refresh'));
    for (const req of restoreReq) {
      req.flush({ message: 'No refresh token' }, { status: 401, statusText: 'Unauthorized' });
    }
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('login', () => {
    it('sends POST, stores token in memory signal, sets user', () => {
      service.login({ email: 'test@test.com', password: 'pw' }).subscribe();

      const req = httpTesting.expectOne(
        (r) => r.url.includes('/auth/login') && r.method === 'POST',
      );
      expect(req.request.withCredentials).toBe(true);
      req.flush(MOCK_AUTH_RESPONSE);

      expect(service.getAccessToken()).toBe('mock-access-token');
      expect(service.user()).toEqual(MOCK_USER);
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('register', () => {
    it('sends POST, stores token in memory signal, sets user', () => {
      service
        .register({
          firstName: 'T',
          lastName: 'U',
          email: 'test@test.com',
          phoneNumber: '0800000000',
          password: 'password123',
        })
        .subscribe();

      const req = httpTesting.expectOne(
        (r) => r.url.includes('/auth/register') && r.method === 'POST',
      );
      expect(req.request.withCredentials).toBe(true);
      req.flush(MOCK_AUTH_RESPONSE);

      expect(service.getAccessToken()).toBe('mock-access-token');
      expect(service.user()).toEqual(MOCK_USER);
    });
  });

  describe('refresh', () => {
    it('sends POST with credentials, updates accessToken and fetches user profile', () => {
      service.refresh().subscribe();

      const refreshReq = httpTesting.expectOne(
        (r) => r.url.includes('/auth/refresh') && r.method === 'POST',
      );
      expect(refreshReq.request.withCredentials).toBe(true);
      refreshReq.flush(MOCK_REFRESH_RESPONSE);

      // refresh() chains fetchMe()
      const meReq = httpTesting.expectOne((r) => r.url.includes('/auth/me'));
      meReq.flush(MOCK_ME_RESPONSE);

      expect(service.getAccessToken()).toBe('refreshed-access-token');
      expect(service.user()).toEqual(MOCK_USER);
    });
  });

  describe('logout', () => {
    it('sends POST and clears session', () => {
      // First login to have state
      service.login({ email: 'test@test.com', password: 'pw' }).subscribe();
      const loginReq = httpTesting.expectOne((r) => r.url.includes('/auth/login'));
      loginReq.flush(MOCK_AUTH_RESPONSE);

      // Now logout
      service.logout().subscribe();
      const logoutReq = httpTesting.expectOne(
        (r) => r.url.includes('/auth/logout') && r.method === 'POST',
      );
      logoutReq.flush({ success: true });

      expect(service.getAccessToken()).toBeNull();
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('fetchMe', () => {
    it('sends GET and sets currentUser', () => {
      service.fetchMe().subscribe();

      const req = httpTesting.expectOne((r) => r.url.includes('/auth/me'));
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_ME_RESPONSE);

      expect(service.user()).toEqual(MOCK_USER);
    });

    it('clears session on error', () => {
      // Set up some state first
      service.login({ email: 'test@test.com', password: 'pw' }).subscribe();
      const loginReq = httpTesting.expectOne((r) => r.url.includes('/auth/login'));
      loginReq.flush(MOCK_AUTH_RESPONSE);

      service.fetchMe().subscribe();
      const meReq = httpTesting.expectOne((r) => r.url.includes('/auth/me'));
      meReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(service.user()).toBeNull();
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no user', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true after login', () => {
      service.login({ email: 'test@test.com', password: 'pw' }).subscribe();
      const req = httpTesting.expectOne((r) => r.url.includes('/auth/login'));
      req.flush(MOCK_AUTH_RESPONSE);

      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('restoreSession (constructor behavior)', () => {
    it('restores session via refresh endpoint when sessionStorage is empty (new tab)', async () => {
      sessionStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      expect(freshService.restoring()).toBe(true);
      await Promise.resolve();

      // Path B: no sessionStorage token → calls POST /auth/refresh
      const refreshReq = freshHttp.expectOne((r) => r.url.includes('/auth/refresh'));
      expect(refreshReq.request.method).toBe('POST');
      expect(refreshReq.request.withCredentials).toBe(true);
      refreshReq.flush(MOCK_REFRESH_RESPONSE);

      const meReq = freshHttp.expectOne((r) => r.url.includes('/auth/me'));
      meReq.flush(MOCK_ME_RESPONSE);

      expect(freshService.getAccessToken()).toBe('refreshed-access-token');
      expect(freshService.user()).toEqual(MOCK_USER);
      expect(freshService.isAuthenticated()).toBe(true);
      expect(freshService.restoring()).toBe(false);

      freshHttp.verify();
    });

    it('restores session from sessionStorage without calling refresh (page reload)', async () => {
      // Simulate a page reload: token already in sessionStorage
      sessionStorage.setItem('pc_hub_at', 'cached-token');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      await Promise.resolve();

      // Path A: sessionStorage has token → calls GET /auth/me only, no POST /auth/refresh
      freshHttp.expectNone((r) => r.url.includes('/auth/refresh'));
      const meReq = freshHttp.expectOne((r) => r.url.includes('/auth/me'));
      meReq.flush(MOCK_ME_RESPONSE);

      expect(freshService.getAccessToken()).toBe('cached-token');
      expect(freshService.user()).toEqual(MOCK_USER);
      expect(freshService.isAuthenticated()).toBe(true);
      expect(freshService.restoring()).toBe(false);

      freshHttp.verify();
      sessionStorage.clear();
    });

    it('clears session when sessionStorage token is invalid (expired)', async () => {
      sessionStorage.setItem('pc_hub_at', 'expired-token');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      await Promise.resolve();

      // fetchMe fails → session cleared
      const meReq = freshHttp.expectOne((r) => r.url.includes('/auth/me'));
      meReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(freshService.getAccessToken()).toBeNull();
      expect(freshService.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem('pc_hub_at')).toBeNull();
      expect(freshService.restoring()).toBe(false);

      freshHttp.verify();
    });

    it('leaves user logged out when refresh fails', async () => {
      sessionStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });

      const freshService = TestBed.inject(AuthService);
      const freshHttp = TestBed.inject(HttpTestingController);

      await Promise.resolve();

      const refreshReq = freshHttp.expectOne((r) => r.url.includes('/auth/refresh'));
      refreshReq.flush({ message: 'No refresh token' }, { status: 401, statusText: 'Unauthorized' });

      expect(freshService.getAccessToken()).toBeNull();
      expect(freshService.user()).toBeNull();
      expect(freshService.isAuthenticated()).toBe(false);
      expect(freshService.restoring()).toBe(false);

      freshHttp.verify();
    });

    it('stores token in sessionStorage, not localStorage', () => {
      service.login({ email: 'test@test.com', password: 'pw' }).subscribe();
      const req = httpTesting.expectOne((r) => r.url.includes('/auth/login'));
      req.flush(MOCK_AUTH_RESPONSE);

      expect(sessionStorage.getItem('pc_hub_at')).toBe('mock-access-token');
      expect(localStorage.getItem('pc_hub_at')).toBeNull();
      sessionStorage.clear();
    });
  });
});
