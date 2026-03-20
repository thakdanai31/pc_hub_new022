import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LanguageSwitcher } from '../../shared/components/language-switcher/language-switcher';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-backoffice-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LanguageSwitcher, TranslatePipe],
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
