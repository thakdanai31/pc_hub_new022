import { Component, computed, input, output, signal } from '@angular/core';

type AlertType = 'error' | 'warning' | 'success' | 'info';

const TYPE_STYLES: Record<AlertType, { container: string; icon: string; iconBg: string }> = {
  error: {
    container:
      'bg-gradient-to-r from-red-50 to-red-100/50 border-l-4 border-red-500 text-red-800 shadow-sm',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
  warning: {
    container:
      'bg-gradient-to-r from-amber-50 to-amber-100/50 border-l-4 border-amber-500 text-amber-800 shadow-sm',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  success: {
    container:
      'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-l-4 border-emerald-500 text-emerald-800 shadow-sm',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  info: {
    container:
      'bg-gradient-to-r from-blue-50 to-blue-100/50 border-l-4 border-blue-500 text-blue-800 shadow-sm',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
};

@Component({
  selector: 'app-alert-banner',
  templateUrl: './alert-banner.html',
})
export class AlertBanner {
  readonly type = input<AlertType>('error');
  readonly message = input.required<string>();
  readonly dismissible = input(false);
  readonly dismissed = output<void>();

  readonly visible = signal(true);

  readonly styles = computed(() => TYPE_STYLES[this.type()]);

  dismiss() {
    this.visible.set(false);
    this.dismissed.emit();
  }
}
