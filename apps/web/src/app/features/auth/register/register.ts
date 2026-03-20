import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, AlertBanner, TranslatePipe],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly language = inject(LanguageService);

  firstName = '';
  lastName = '';
  email = '';
  phoneNumber = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  submitted = false;
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly serverFieldErrors = signal<Record<string, string>>({});

  get hasPasswordMismatch() {
    return this.confirmPassword.length > 0 && this.password !== this.confirmPassword;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onSubmit(form: { valid?: boolean | null }) {
    this.submitted = true;
    this.errorMessage.set('');
    this.serverFieldErrors.set({});

    if (!form.valid || this.password !== this.confirmPassword) {
      return;
    }

    this.loading.set(true);

    this.auth
      .register({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        phoneNumber: this.phoneNumber.trim(),
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
            this.serverFieldErrors.set({
              email: this.language.translate('auth.register.emailTaken'),
            });
            this.errorMessage.set(this.language.translate('auth.register.fixErrors'));
          } else if (err.status === 409 && body.code === 'PHONE_TAKEN') {
            this.serverFieldErrors.set({
              phoneNumber: this.language.translate('auth.register.phoneTaken'),
            });
            this.errorMessage.set(this.language.translate('auth.register.fixErrors'));
          } else if (body.fieldErrors) {
            this.serverFieldErrors.set(body.fieldErrors);
            this.errorMessage.set(this.language.translate('auth.register.fixErrors'));
          } else if (err.status === 400) {
            this.errorMessage.set(
              body.message ?? this.language.translate('auth.register.checkInput'),
            );
          } else {
            this.errorMessage.set(this.language.translate('common.errorGeneric'));
          }
        },
      });
  }
}
