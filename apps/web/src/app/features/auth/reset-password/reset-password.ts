import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, AlertBanner, TranslatePipe],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly language = inject(LanguageService);
  private readonly resetToken =
    this.route.snapshot.queryParamMap.get('token')?.trim() ?? '';

  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  submitted = false;
  readonly loading = signal(false);
  readonly resetComplete = signal(false);
  readonly errorMessage = signal('');
  readonly serverFieldErrors = signal<Record<string, string>>({});

  get hasPasswordMismatch() {
    return (
      this.confirmPassword.length > 0 && this.password !== this.confirmPassword
    );
  }

  get hasResetToken() {
    return this.resetToken.length > 0;
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

    if (!this.hasResetToken) {
      this.errorMessage.set(
        this.language.translate('auth.resetPassword.invalidLink'),
      );
      return;
    }

    if (!form.valid || this.password !== this.confirmPassword) {
      return;
    }

    this.loading.set(true);

    this.auth
      .resetPassword({
        token: this.resetToken,
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.resetComplete.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = extractErrorBody(err.error);

          if (body.fieldErrors) {
            this.serverFieldErrors.set(body.fieldErrors);
            this.errorMessage.set(
              this.language.translate('auth.resetPassword.fixErrors'),
            );
            return;
          }

          if (body.code === 'INVALID_RESET_TOKEN') {
            this.errorMessage.set(
              this.language.translate('auth.resetPassword.invalidToken'),
            );
            return;
          }

          if (body.code === 'RESET_TOKEN_EXPIRED') {
            this.errorMessage.set(
              this.language.translate('auth.resetPassword.expiredToken'),
            );
            return;
          }

          if (body.code === 'RESET_TOKEN_USED') {
            this.errorMessage.set(
              this.language.translate('auth.resetPassword.usedToken'),
            );
            return;
          }

          this.errorMessage.set(
            body.message ??
              this.language.translate('auth.resetPassword.requestError'),
          );
        },
      });
  }
}
