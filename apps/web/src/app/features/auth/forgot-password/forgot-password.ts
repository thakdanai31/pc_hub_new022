import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, AlertBanner, TranslatePipe],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  email = '';
  submitted = false;
  readonly loading = signal(false);
  readonly requestSent = signal(false);
  readonly errorMessage = signal('');
  readonly debugResetLink = signal<string | null>(null);
  readonly serverFieldErrors = signal<Record<string, string>>({});

  onSubmit(form: { valid?: boolean | null }) {
    this.submitted = true;
    this.errorMessage.set('');
    this.serverFieldErrors.set({});

    if (!form.valid) {
      return;
    }

    this.loading.set(true);

    this.auth
      .requestPasswordReset({
        email: this.email.trim(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.requestSent.set(true);
          this.debugResetLink.set(res.data?.resetLink ?? null);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = extractErrorBody(err.error);

          if (body.fieldErrors) {
            this.serverFieldErrors.set(body.fieldErrors);
            this.errorMessage.set(
              this.language.translate('auth.forgotPassword.fixErrors'),
            );
            return;
          }

          this.errorMessage.set(
            body.message ??
              this.language.translate('auth.forgotPassword.requestError'),
          );
        },
      });
  }
}
