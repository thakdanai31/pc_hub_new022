import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'thaiBaht', standalone: true })
export class ThaiBahtPipe implements PipeTransform {
  transform(value: number): string {
    return value.toLocaleString('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    });
  }
}
