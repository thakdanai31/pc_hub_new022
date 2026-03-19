import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Wait for session restoration before checking role
    if (authService.restoring()) {
      return toObservable(authService.restoring).pipe(
        filter((restoring) => !restoring),
        take(1),
        map(() => {
          const user = authService.user();
          if (!user) {
            return router.createUrlTree(['/login']);
          }
          if (!allowedRoles.includes(user.role)) {
            return router.createUrlTree(['/']);
          }
          return true;
        }),
      );
    }

    const user = authService.user();
    if (!user) {
      return router.createUrlTree(['/login']);
    }

    if (!allowedRoles.includes(user.role)) {
      return router.createUrlTree(['/']);
    }

    return true;
  };
}
