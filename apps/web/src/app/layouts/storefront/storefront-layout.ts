import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-storefront-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './storefront-layout.html',
})
export class StorefrontLayout implements OnInit {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly cartService = inject(CartService);

  protected readonly mobileMenuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.cartService.loadCart().subscribe();
    }
  }

  protected isStaffOrAdmin(): boolean {
    const role = this.auth.user()?.role;
    return role === 'STAFF' || role === 'ADMIN';
  }

  protected toggleMobileMenu() {
    this.mobileMenuOpen.update((v) => !v);
    if (this.mobileMenuOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  protected closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  protected toggleUserMenu() {
    this.userMenuOpen.update((v) => !v);
  }

  protected closeUserMenu() {
    this.userMenuOpen.set(false);
  }

  onLogout() {
    this.userMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
    this.auth.logout().subscribe(() => {
      this.cartService.clearLocalCart();
      void this.router.navigate(['/login']);
    });
  }
}
