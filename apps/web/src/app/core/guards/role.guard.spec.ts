import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { routes } from '../../app.routes';

describe('roleGuard', () => {
  let router: Router;
  let authService: AuthService;
  const dailySalesRoute = routes
    .find((route) => route.path === 'backoffice')
    ?.children?.find((route) => route.path === 'reports/daily-sales');

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);

    // Flush the startup restoreSession refresh request so restoring() is false
    const httpTesting = TestBed.inject(HttpTestingController);
    await Promise.resolve();
    const startupReqs = httpTesting.match((r) => r.url.includes('/auth/refresh'));
    for (const req of startupReqs) {
      req.flush({ message: 'No token' }, { status: 401, statusText: 'Unauthorized' });
    }
  });

  it('returns true when user has an allowed role', () => {
    // Simulate an authenticated admin user
    Object.defineProperty(authService, 'user', {
      value: () => ({ id: 1, email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'ADMIN' as const, isActive: true }),
    });

    const guard = roleGuard('STAFF', 'ADMIN');
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects to / when user role is not in allowed list', () => {
    Object.defineProperty(authService, 'user', {
      value: () => ({ id: 1, email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'CUSTOMER' as const, isActive: true }),
    });

    const guard = roleGuard('STAFF', 'ADMIN');
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));

    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('redirects to /login when user is null', () => {
    Object.defineProperty(authService, 'user', {
      value: () => null,
    });

    const guard = roleGuard('STAFF', 'ADMIN');
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));

    expect(result).toEqual(router.createUrlTree(['/login']));
  });

  it('uses an admin-only guard for the Daily Sales route', () => {
    const guard = dailySalesRoute?.canActivate?.[0];
    expect(guard).toBeDefined();

    Object.defineProperty(authService, 'user', {
      value: () => ({ id: 1, email: 'staff@test.com', firstName: 'S', lastName: 'T', role: 'STAFF' as const, isActive: true }),
    });

    const denied = TestBed.runInInjectionContext(() =>
      (guard as ReturnType<typeof roleGuard>)({} as never, {} as never),
    );
    expect(denied).toEqual(router.createUrlTree(['/']));

    Object.defineProperty(authService, 'user', {
      value: () => ({ id: 2, email: 'admin@test.com', firstName: 'A', lastName: 'D', role: 'ADMIN' as const, isActive: true }),
    });

    const allowed = TestBed.runInInjectionContext(() =>
      (guard as ReturnType<typeof roleGuard>)({} as never, {} as never),
    );
    expect(allowed).toBe(true);
  });
});
