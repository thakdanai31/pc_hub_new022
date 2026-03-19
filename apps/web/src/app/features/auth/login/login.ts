import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AlertBanner],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  submitted = false;
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly serverFieldErrors = signal<Record<string, string>>({});

  onSubmit(form: { valid?: boolean | null }) {
    this.submitted = true;
    if (!form.valid) return;

    this.loading.set(true);
    this.errorMessage.set('');
    this.serverFieldErrors.set({});

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = extractErrorBody(err.error);
        if (err.status === 401) {
          this.errorMessage.set('Invalid email or password.');
        } else if (body.fieldErrors) {
          this.serverFieldErrors.set(body.fieldErrors);
          this.errorMessage.set('Please fix the errors below.');
        } else {
          this.errorMessage.set(body.message ?? 'Something went wrong. Please try again.');
        }
      },
    });
  }
}
