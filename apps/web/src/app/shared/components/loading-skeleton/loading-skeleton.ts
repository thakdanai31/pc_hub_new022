import { Component, computed, input } from '@angular/core';

type SkeletonVariant = 'card' | 'table-row' | 'detail';

@Component({
  selector: 'app-loading-skeleton',
  templateUrl: './loading-skeleton.html',
})
export class LoadingSkeleton {
  readonly variant = input<SkeletonVariant>('card');
  readonly count = input(1);

  readonly items = computed(() => Array.from({ length: this.count() }));
}
