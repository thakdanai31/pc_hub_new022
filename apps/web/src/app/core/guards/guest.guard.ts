import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for session restoration before deciding
  if (authService.restoring()) {
    return toObservable(authService.restoring).pipe(
      filter((restoring) => !restoring),
      take(1),
      map(() => {
        if (!authService.isAuthenticated()) {
          return true;
        }
        return router.createUrlTree(['/']);
      }),
    );
  }

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
