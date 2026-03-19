import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { BackofficeUserService } from '../../../core/services/backoffice-user.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-bo-user-form',
  imports: [RouterLink, FormsModule, UpperCasePipe, AlertBanner],
  templateUrl: './user-form.html',
})
export class BoUserFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userService = inject(BackofficeUserService);

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal('');
  protected readonly serverFieldErrors = signal<Record<string, string>>({});
  protected readonly roleLabel = signal('Staff');
  protected readonly validRole = signal(false);
  protected submitted = false;

  private role: 'staff' | 'admin' = 'staff';

  protected form = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
  };

  ngOnInit() {
    const roleParam = this.route.snapshot.paramMap.get('role');
    if (roleParam !== 'staff' && roleParam !== 'admin') {
      this.router.navigate(['/backoffice/users']);
      return;
    }
    this.validRole.set(true);
    if (roleParam === 'admin') {
      this.role = 'admin';
      this.roleLabel.set('Admin');
    }
  }

  onSubmit(formRef: { valid?: boolean | null }) {
    this.submitted = true;
    if (!formRef.valid) return;

    this.saving.set(true);
    this.errorMsg.set('');
    this.serverFieldErrors.set({});

    this.userService
      .createUser(this.role, {
        firstName: this.form.firstName.trim(),
        lastName: this.form.lastName.trim(),
        email: this.form.email.trim(),
        phoneNumber: this.form.phoneNumber.trim(),
        password: this.form.password,
      })
      .subscribe({
        next: () => {
          this.router.navigate(['/backoffice/users']);
        },
        error: (err) => {
          this.saving.set(false);
          const body = extractErrorBody(err.error);
          if (body.code === 'EMAIL_TAKEN') {
            this.serverFieldErrors.set({ email: 'This email is already registered.' });
            this.errorMsg.set('Please fix the errors below.');
          } else if (body.fieldErrors) {
            this.serverFieldErrors.set(body.fieldErrors);
            this.errorMsg.set('Please fix the errors below.');
          } else {
            this.errorMsg.set(body.message ?? 'Failed to create user');
          }
        },
      });
  }
}
