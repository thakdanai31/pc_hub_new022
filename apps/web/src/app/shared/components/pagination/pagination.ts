import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.html',
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.page();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const result: number[] = [1];

    if (current > 3) {
      result.push(-1); // ellipsis
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      result.push(i);
    }

    if (current < total - 2) {
      result.push(-1); // ellipsis
    }

    result.push(total);
    return result;
  });

  onPage(p: number) {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) {
      this.pageChange.emit(p);
    }
  }
}
