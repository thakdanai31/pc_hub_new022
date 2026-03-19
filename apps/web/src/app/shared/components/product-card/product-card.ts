import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThaiBahtPipe } from '../../pipes/thai-baht.pipe';
import type { ProductSummary } from '../../models/product.model';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, ThaiBahtPipe],
  templateUrl: './product-card.html',
})
export class ProductCard {
  readonly product = input.required<ProductSummary>();
}
