import { Component, inject, signal, OnInit, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BackofficeUserService, type AdminUser } from '../../../core/services/backoffice-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-bo-user-list',
  imports: [RouterLink, FormsModule, DatePipe, PageHeader, Pagination, ConfirmDialog, AlertBanner, EmptyState],
  templateUrl: './user-list.html',
})
export class BoUserListPage implements OnInit {
  private readonly userService = inject(BackofficeUserService);
  private readonly auth = inject(AuthService);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal('');
  protected readonly currentUserId = signal<number | null>(null);

  protected search = '';
  protected roleFilter = '';
  private currentPage = 1;

  readonly disableDialog = viewChild<ConfirmDialog>('disableDialog');
  private pendingDisableUser: AdminUser | null = null;

  protected editForm = { firstName: '', lastName: '', phoneNumber: '' };

  ngOnInit() {
    this.currentUserId.set(this.auth.user()?.id ?? null);
    this.loadUsers();
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadUsers();
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadUsers();
  }

  onStartEdit(user: AdminUser) {
    this.editingUserId.set(user.id);
    this.editError.set('');
    this.editForm = {
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
    };
  }

  onSaveEdit() {
    const userId = this.editingUserId();
    if (!userId) return;
    this.editSaving.set(true);
    this.editError.set('');

    this.userService.updateUser(userId, {
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      phoneNumber: this.editForm.phoneNumber,
    }).subscribe({
      next: (res) => {
        const updated = this.users().map((u) =>
          u.id === userId ? { ...u, ...res.data } : u,
        );
        this.users.set(updated);
        this.editingUserId.set(null);
        this.editSaving.set(false);
      },
      error: (err) => {
        this.editError.set(err.error?.message ?? 'Failed to update user');
        this.editSaving.set(false);
      },
    });
  }

  confirmDisable(user: AdminUser) {
    this.pendingDisableUser = user;
    this.disableDialog()?.show();
  }

  onDisableConfirmed() {
    const target = this.pendingDisableUser;
    if (!target) return;
    this.userService.disableUser(target.id).subscribe({
      next: (res) => {
        const updated = this.users().map((u) =>
          u.id === target.id ? { ...u, isActive: res.data.isActive } : u,
        );
        this.users.set(updated);
        this.pendingDisableUser = null;
      },
    });
  }

  protected loadUsers() {
    this.loading.set(true);
    this.error.set('');
    this.userService
      .listUsers({
        page: this.currentPage,
        limit: 20,
        search: this.search || undefined,
        role: this.roleFilter === 'STAFF' || this.roleFilter === 'ADMIN' ? this.roleFilter : undefined,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.data);
          this.pagination.set(res.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load users.');
          this.loading.set(false);
        },
      });
  }
}
