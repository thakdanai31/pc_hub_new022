import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-backoffice-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './backoffice-layout.html',
})
export class BackofficeLayout {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly sidebarOpen = signal(false);

  protected isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  onLogout() {
    this.auth.logout().subscribe(() => {
      void this.router.navigate(['/login']);
    });
  }
}
