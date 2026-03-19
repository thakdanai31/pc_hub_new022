import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { extractErrorBody } from '../../../shared/utils/error.utils';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';

@Component({
  selector: 'app-profile-page',
  imports: [FormsModule, RouterLink, AlertBanner],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');

  email = '';
  role = '';
  firstName = '';
  lastName = '';
  phoneNumber = '';

  ngOnInit() {
    this.profileService.getProfile().subscribe({
      next: (res) => {
        this.email = res.data.email;
        this.role = res.data.role;
        this.firstName = res.data.firstName;
        this.lastName = res.data.lastName;
        this.phoneNumber = res.data.phoneNumber;
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load profile.');
        this.loading.set(false);
      },
    });
  }

  onSave() {
    this.saving.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.profileService
      .updateProfile({
        firstName: this.firstName,
        lastName: this.lastName,
        phoneNumber: this.phoneNumber,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.successMessage.set('Profile updated successfully.');
          this.firstName = res.data.firstName;
          this.lastName = res.data.lastName;
          this.phoneNumber = res.data.phoneNumber;
          // Refresh the auth user data so navbar reflects updated name
          this.auth.fetchMe().subscribe();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          const body = extractErrorBody(err.error);
          this.error.set(body.message ?? 'Failed to update profile.');
        },
      });
  }
}
