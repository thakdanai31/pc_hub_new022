import { Component, inject, input, output, signal } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  private readonly language = inject(LanguageService);

  readonly title = input('');
  readonly message = input.required<string>();
  readonly confirmLabel = input('');
  readonly cancelLabel = input('');
  readonly destructive = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly open = signal(false);

  protected resolvedTitle() {
    return this.title() || this.language.translate('common.areYouSure');
  }

  protected resolvedConfirmLabel() {
    return this.confirmLabel() || this.language.translate('common.confirm');
  }

  protected resolvedCancelLabel() {
    return this.cancelLabel() || this.language.translate('common.cancel');
  }

  show() {
    this.open.set(true);
  }

  hide() {
    this.open.set(false);
  }

  onConfirm() {
    this.confirmed.emit();
    this.hide();
  }

  onCancel() {
    this.cancelled.emit();
    this.hide();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}
