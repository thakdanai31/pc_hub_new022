import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ProductCard } from '../../shared/components/product-card/product-card';
import type { ProductSummary } from '../../shared/models/product.model';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  private readonly catalog = inject(CatalogService);

  readonly featuredProducts = signal<ProductSummary[]>([]);
  readonly loadingProducts = signal(true);

  ngOnInit() {
    this.catalog
      .listProducts({ sort: 'newest', limit: '8' })
      .subscribe({
        next: (res) => {
          this.featuredProducts.set(res.data);
          this.loadingProducts.set(false);
        },
        error: () => {
          this.loadingProducts.set(false);
        },
      });
  }
}
