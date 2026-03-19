import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  readonly title = input('Are you sure?');
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly destructive = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly open = signal(false);

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
