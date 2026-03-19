import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';
import type { CategorySummary } from '../../shared/models/category.model';
import type { BrandSummary } from '../../shared/models/brand.model';
import type { ProductSummary, ProductDetail } from '../../shared/models/product.model';
import type { ApiResponse } from '../../shared/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listCategories() {
    return this.http.get<PaginatedApiResponse<CategorySummary>>(
      `${this.apiUrl}/categories`,
      { params: { limit: '100' } },
    );
  }

  listBrands() {
    return this.http.get<PaginatedApiResponse<BrandSummary>>(
      `${this.apiUrl}/brands`,
      { params: { limit: '100' } },
    );
  }

  listProducts(filters: Record<string, string>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.http.get<PaginatedApiResponse<ProductSummary>>(
      `${this.apiUrl}/products`,
      { params },
    );
  }

  getProductBySlug(slug: string) {
    return this.http.get<ApiResponse<ProductDetail>>(
      `${this.apiUrl}/products/slug/${slug}`,
    );
  }

  getProductById(id: number) {
    return this.http.get<ApiResponse<ProductDetail>>(
      `${this.apiUrl}/products/${id}`,
    );
  }
}
