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
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AlertBanner, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly language = inject(LanguageService);

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
          this.errorMessage.set(this.language.translate('auth.login.invalidCredentials'));
        } else if (body.fieldErrors) {
          this.serverFieldErrors.set(body.fieldErrors);
          this.errorMessage.set(this.language.translate('auth.login.fixErrors'));
        } else {
          this.errorMessage.set(
            body.message ?? this.language.translate('common.errorGeneric'),
          );
        }
      },
    });
  }
}
