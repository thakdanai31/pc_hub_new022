import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly actionLabel = input<string>();
  readonly action = output<void>();

  onAction() {
    this.action.emit();
  }
}
