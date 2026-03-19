import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Wait for session restoration before redirecting
  if (authService.restoring()) {
    return toObservable(authService.restoring).pipe(
      filter((restoring) => !restoring),
      take(1),
      map(() => {
        if (authService.isAuthenticated()) {
          return true;
        }
        return router.createUrlTree(['/login']);
      }),
    );
  }

  return router.createUrlTree(['/login']);
};
