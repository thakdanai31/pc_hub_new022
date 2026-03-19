import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, AlertBanner],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  phoneNumber = '';
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

    this.auth
      .register({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phoneNumber: this.phoneNumber,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigate(['/']);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = extractErrorBody(err.error);
          if (err.status === 409 && body.code === 'EMAIL_TAKEN') {
            this.serverFieldErrors.set({ email: 'This email is already registered.' });
            this.errorMessage.set('Please fix the errors below.');
          } else if (body.fieldErrors) {
            this.serverFieldErrors.set(body.fieldErrors);
            this.errorMessage.set('Please fix the errors below.');
          } else if (err.status === 400) {
            this.errorMessage.set(body.message ?? 'Please check your input.');
          } else {
            this.errorMessage.set('Something went wrong. Please try again.');
          }
        },
      });
  }
}
