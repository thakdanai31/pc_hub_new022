import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BackofficeUserService,
  type AdminUser,
  type UserRole,
} from '../../../core/services/backoffice-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { AlertBanner } from '../../../shared/components/alert-banner/alert-banner';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import type { PaginationMeta } from '../../../shared/models/pagination.model';

@Component({
  selector: 'app-bo-user-list',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    PageHeader,
    Pagination,
    ConfirmDialog,
    AlertBanner,
    EmptyState,
    TranslatePipe,
  ],
  templateUrl: './user-list.html',
})
export class BoUserListPage implements OnInit {
  private readonly userService = inject(BackofficeUserService);
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly pagination = signal<PaginationMeta | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal('');
  protected readonly currentUserId = signal<number | null>(null);
  protected readonly actionSaving = signal(false);
  protected readonly actionError = signal('');
  protected readonly actionSuccess = signal('');
  protected readonly banUserId = signal<number | null>(null);
  protected readonly banMode = signal<'permanent' | 'temporary' | null>(null);
  protected readonly banError = signal('');

  protected search = '';
  protected roleFilter = '';
  private currentPage = 1;

  readonly statusDialog = viewChild<ConfirmDialog>('statusDialog');
  private pendingUnbanUser: AdminUser | null = null;

  protected editForm = { firstName: '', lastName: '', phoneNumber: '' };
  protected banForm = { bannedUntil: '', banReason: '' };

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
    if (!this.canEdit(user)) {
      return;
    }

    this.cancelBan();
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
    if (!userId) {
      return;
    }

    this.editSaving.set(true);
    this.editError.set('');

    this.userService.updateUser(userId, {
      firstName: this.editForm.firstName,
      lastName: this.editForm.lastName,
      phoneNumber: this.editForm.phoneNumber,
    }).subscribe({
      next: (res) => {
        const updated = this.users().map((user) =>
          user.id === userId ? { ...user, ...res.data } : user,
        );
        this.users.set(updated);
        this.editingUserId.set(null);
        this.editSaving.set(false);
      },
      error: (err) => {
        this.editError.set(
          err.error?.message ??
            this.language.translate('backoffice.users.updateError'),
        );
        this.editSaving.set(false);
      },
    });
  }

  protected cancelEdit() {
    this.editingUserId.set(null);
    this.editError.set('');
  }

  protected startBan(user: AdminUser, mode: 'permanent' | 'temporary') {
    if (!this.canChangeStatus(user) || !user.isActive) {
      return;
    }

    this.cancelEdit();
    this.pendingUnbanUser = null;
    this.actionError.set('');
    this.actionSuccess.set('');
    this.banError.set('');
    this.banUserId.set(user.id);
    this.banMode.set(mode);
    this.banForm = {
      bannedUntil: mode === 'temporary' ? this.getDefaultBanUntilValue() : '',
      banReason: '',
    };
  }

  protected cancelBan() {
    this.banUserId.set(null);
    this.banMode.set(null);
    this.banError.set('');
    this.banForm = { bannedUntil: '', banReason: '' };
  }

  protected submitBan() {
    const userId = this.banUserId();
    const mode = this.banMode();

    if (!userId || !mode || this.actionSaving()) {
      return;
    }

    const banReason = this.banForm.banReason.trim() || undefined;
    let bannedUntil: string | undefined;

    if (mode === 'temporary') {
      const parsedDate = new Date(this.banForm.bannedUntil);

      if (
        !this.banForm.bannedUntil ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate <= new Date()
      ) {
        this.banError.set(
          this.language.translate('backoffice.users.futureBanRequired'),
        );
        return;
      }

      bannedUntil = parsedDate.toISOString();
    }

    this.actionSaving.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.banError.set('');

    this.userService.disableUser(userId, {
      bannedUntil,
      banReason,
    }).subscribe({
      next: (res) => {
        const updated = this.users().map((user) =>
          user.id === userId ? { ...user, ...res.data } : user,
        );
        this.users.set(updated);
        this.actionSaving.set(false);
        this.actionSuccess.set(
          mode === 'temporary'
            ? this.language.translate('backoffice.users.userTemporarilyBanned')
            : this.language.translate('backoffice.users.userPermanentlyBanned'),
        );
        this.cancelBan();
      },
      error: (err) => {
        this.actionSaving.set(false);
        this.banError.set(
          err.error?.message ??
            this.language.translate('backoffice.users.disableError'),
        );
      },
    });
  }

  protected confirmUnban(user: AdminUser) {
    if (!this.canChangeStatus(user) || user.isActive) {
      return;
    }

    this.cancelEdit();
    this.cancelBan();
    this.pendingUnbanUser = user;
    this.actionError.set('');
    this.actionSuccess.set('');
    this.statusDialog()?.show();
  }

  onStatusChangeConfirmed() {
    const target = this.pendingUnbanUser;
    if (!target || this.actionSaving()) {
      return;
    }

    this.actionSaving.set(true);
    this.actionError.set('');
    this.actionSuccess.set('');

    this.userService.enableUser(target.id).subscribe({
      next: (res) => {
        const updated = this.users().map((user) =>
          user.id === target.id ? { ...user, ...res.data } : user,
        );
        this.users.set(updated);
        this.pendingUnbanUser = null;
        this.actionSuccess.set(
          this.language.translate('backoffice.users.userUnbanned'),
        );
        this.actionSaving.set(false);
      },
      error: (err) => {
        this.actionError.set(
          err.error?.message ??
            this.language.translate('backoffice.users.enableError'),
        );
        this.actionSaving.set(false);
      },
    });
  }

  protected canEdit(user: AdminUser) {
    return user.role !== 'CUSTOMER';
  }

  protected canChangeStatus(user: AdminUser) {
    return user.id !== this.currentUserId();
  }

  protected isCustomer(user: AdminUser) {
    return user.role === 'CUSTOMER';
  }

  protected isAdmin(user: AdminUser) {
    return user.role === 'ADMIN';
  }

  protected isTemporaryBan(user: AdminUser) {
    return !user.isActive && !!user.bannedUntil;
  }

  protected showInlineEdit(user: AdminUser) {
    return this.editingUserId() === user.id && this.canEdit(user);
  }

  protected showBanForm(user: AdminUser) {
    return this.banUserId() === user.id && user.isActive;
  }

  protected userStatusLabel(user: AdminUser) {
    if (user.isActive) {
      return this.language.translate('backoffice.users.active');
    }

    return user.bannedUntil
      ? this.language.translate('backoffice.users.temporarilyBanned')
      : this.language.translate('backoffice.users.banned');
  }

  protected userStatusClass(user: AdminUser) {
    if (user.isActive) {
      return 'bg-emerald-50 text-emerald-700';
    }

    return user.bannedUntil ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  }

  protected userStatusDotClass(user: AdminUser) {
    if (user.isActive) {
      return 'bg-emerald-500';
    }

    return user.bannedUntil ? 'bg-amber-500' : 'bg-red-500';
  }

  protected statusDialogTitle() {
    return this.language.translate('backoffice.users.unbanTitle');
  }

  protected statusDialogMessage() {
    return this.language.translate('backoffice.users.unbanMessage');
  }

  protected statusDialogConfirmLabel() {
    return this.language.translate('backoffice.users.unban');
  }

  protected statusDialogDestructive() {
    return false;
  }

  protected minimumBanDateTime() {
    return this.toDateTimeLocalValue(new Date());
  }

  protected loadUsers() {
    this.loading.set(true);
    this.error.set('');

    this.userService.listUsers({
      page: this.currentPage,
      limit: 20,
      search: this.search || undefined,
      role: this.getSelectedRoleFilter(),
    }).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.pagination.set(res.pagination);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.language.translate('backoffice.users.loadError'));
        this.loading.set(false);
      },
    });
  }

  private getSelectedRoleFilter(): UserRole | undefined {
    return this.roleFilter === 'CUSTOMER' ||
      this.roleFilter === 'STAFF' ||
      this.roleFilter === 'ADMIN'
      ? this.roleFilter
      : undefined;
  }

  private getDefaultBanUntilValue() {
    const oneDayLater = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.toDateTimeLocalValue(oneDayLater);
  }

  private toDateTimeLocalValue(date: Date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }
}
