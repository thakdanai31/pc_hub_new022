import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  HttpErrorResponse,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);

    // Flush the startup restoreSession refresh request
    await Promise.resolve();
    const startupReqs = httpTesting.match((r) => r.url.includes('/auth/refresh'));
    for (const req of startupReqs) {
      req.flush({ message: 'No token' }, { status: 401, statusText: 'Unauthorized' });
    }
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('attaches Authorization header when token exists', () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue('my-token');

    httpClient.get('/api/v1/products').subscribe();

    const req = httpTesting.expectOne('/api/v1/products');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush([]);
    vi.restoreAllMocks();
  });

  it('does not attach header when no token', () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue(null);

    httpClient.get('/api/v1/products').subscribe();

    const req = httpTesting.expectOne('/api/v1/products');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    vi.restoreAllMocks();
  });

  it('on 401 from non-auth endpoint: refreshes and retries with new token', async () => {
    let callCount = 0;
    vi.spyOn(authService, 'getAccessToken').mockImplementation(() => {
      callCount++;
      return callCount <= 1 ? 'old-token' : 'new-token';
    });

    vi.spyOn(authService, 'refresh').mockReturnValue(
      new (await import('rxjs')).Observable((subscriber) => {
        subscriber.next({ success: true, data: { accessToken: 'new-token' } } as never);
        subscriber.complete();
      }),
    );

    const resultPromise = firstValueFrom(httpClient.get('/api/v1/account/orders'));

    // First request gets 401
    const firstReq = httpTesting.expectOne('/api/v1/account/orders');
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    // Retry request after refresh
    const retryReq = httpTesting.expectOne('/api/v1/account/orders');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({ data: [] });

    const result = await resultPromise;
    expect(result).toEqual({ data: [] });
    vi.restoreAllMocks();
  });

  it('on 401 during refresh failure: clears session and navigates to /login', async () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue('old-token');
    const clearSpy = vi.spyOn(authService, 'clearSession');
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    vi.spyOn(authService, 'refresh').mockReturnValue(
      new (await import('rxjs')).Observable((subscriber) => {
        subscriber.error(new HttpErrorResponse({ status: 401 }));
      }),
    );

    const resultPromise = firstValueFrom(httpClient.get('/api/v1/account/orders'));

    // First request gets 401
    const firstReq = httpTesting.expectOne('/api/v1/account/orders');
    firstReq.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expect(resultPromise).rejects.toThrow();
    expect(clearSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/login']);
    vi.restoreAllMocks();
  });

  it('does not intercept 401 on /auth/login', () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue(null);
    const refreshSpy = vi.spyOn(authService, 'refresh');

    httpClient.post('/api/v1/auth/login', {}).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpTesting.expectOne('/api/v1/auth/login');
    req.flush({ message: 'Invalid' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not intercept 401 on /auth/register', () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue(null);
    const refreshSpy = vi.spyOn(authService, 'refresh');

    httpClient.post('/api/v1/auth/register', {}).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpTesting.expectOne('/api/v1/auth/register');
    req.flush({ message: 'Error' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not intercept 401 on /auth/refresh', () => {
    vi.spyOn(authService, 'getAccessToken').mockReturnValue('some-token');
    const refreshSpy = vi.spyOn(authService, 'refresh');

    httpClient.post('/api/v1/auth/refresh', {}).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      },
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/auth/refresh'));
    req.flush({ message: 'Expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
