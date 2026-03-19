import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../../shared/models/api-response.model';
import type { PaginatedApiResponse } from '../../shared/models/pagination.model';

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  warrantyMonths: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  image: string | null;
}

export interface AdminProductDetail {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  warrantyMonths: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  images: { id: number; imageUrl: string; altText: string | null; sortOrder: number }[];
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: { id: number; name: string } | null;
  _count?: { products: number };
}

export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number;
  brandId?: number;
  isActive?: boolean;
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class BackofficeCatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // --- Products ---
  listProducts(params: ProductListParams = {}) {
    const q: Record<string, string> = {};
    if (params.page) q['page'] = String(params.page);
    if (params.limit) q['limit'] = String(params.limit);
    if (params.search) q['search'] = params.search;
    if (params.categoryId) q['categoryId'] = String(params.categoryId);
    if (params.brandId) q['brandId'] = String(params.brandId);
    if (params.isActive !== undefined) q['isActive'] = String(params.isActive);
    if (params.sort) q['sort'] = params.sort;

    return this.http.get<PaginatedApiResponse<AdminProduct>>(
      `${this.apiUrl}/backoffice/products`,
      { params: q },
    );
  }

  getProduct(productId: number) {
    return this.http.get<ApiResponse<AdminProductDetail>>(
      `${this.apiUrl}/backoffice/products/${productId}`,
    );
  }

  createProduct(body: Record<string, unknown>) {
    return this.http.post<ApiResponse<AdminProductDetail>>(
      `${this.apiUrl}/backoffice/products`,
      body,
    );
  }

  updateProduct(productId: number, body: Record<string, unknown>) {
    return this.http.patch<ApiResponse<AdminProductDetail>>(
      `${this.apiUrl}/backoffice/products/${productId}`,
      body,
    );
  }

  deleteProduct(productId: number) {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/backoffice/products/${productId}`,
    );
  }

  toggleProductActive(productId: number) {
    return this.http.post<ApiResponse<{ isActive: boolean }>>(
      `${this.apiUrl}/backoffice/products/${productId}/toggle-active`,
      {},
    );
  }

  uploadProductImage(productId: number, file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<{ id: number; imageUrl: string }>>(
      `${this.apiUrl}/backoffice/products/${productId}/images`,
      formData,
    );
  }

  deleteProductImage(productId: number, imageId: number) {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/backoffice/products/${productId}/images/${imageId}`,
    );
  }

  // --- Categories ---
  listCategories(params: { page?: number; limit?: number; search?: string } = {}) {
    const q: Record<string, string> = {};
    if (params.page) q['page'] = String(params.page);
    if (params.limit) q['limit'] = String(params.limit);
    if (params.search) q['search'] = params.search;

    return this.http.get<PaginatedApiResponse<AdminCategory>>(
      `${this.apiUrl}/backoffice/categories`,
      { params: q },
    );
  }

  createCategory(body: Record<string, unknown>) {
    return this.http.post<ApiResponse<AdminCategory>>(
      `${this.apiUrl}/backoffice/categories`,
      body,
    );
  }

  updateCategory(categoryId: number, body: Record<string, unknown>) {
    return this.http.patch<ApiResponse<AdminCategory>>(
      `${this.apiUrl}/backoffice/categories/${categoryId}`,
      body,
    );
  }

  deleteCategory(categoryId: number) {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/backoffice/categories/${categoryId}`,
    );
  }

  toggleCategoryActive(categoryId: number) {
    return this.http.post<ApiResponse<{ isActive: boolean }>>(
      `${this.apiUrl}/backoffice/categories/${categoryId}/toggle-active`,
      {},
    );
  }

  // --- Brands ---
  listBrands(params: { page?: number; limit?: number; search?: string } = {}) {
    const q: Record<string, string> = {};
    if (params.page) q['page'] = String(params.page);
    if (params.limit) q['limit'] = String(params.limit);
    if (params.search) q['search'] = params.search;

    return this.http.get<PaginatedApiResponse<AdminBrand>>(
      `${this.apiUrl}/backoffice/brands`,
      { params: q },
    );
  }

  createBrand(body: Record<string, unknown>) {
    return this.http.post<ApiResponse<AdminBrand>>(
      `${this.apiUrl}/backoffice/brands`,
      body,
    );
  }

  updateBrand(brandId: number, body: Record<string, unknown>) {
    return this.http.patch<ApiResponse<AdminBrand>>(
      `${this.apiUrl}/backoffice/brands/${brandId}`,
      body,
    );
  }

  deleteBrand(brandId: number) {
    return this.http.delete<ApiResponse<null>>(
      `${this.apiUrl}/backoffice/brands/${brandId}`,
    );
  }

  toggleBrandActive(brandId: number) {
    return this.http.post<ApiResponse<{ isActive: boolean }>>(
      `${this.apiUrl}/backoffice/brands/${brandId}/toggle-active`,
      {},
    );
  }

  uploadBrandLogo(brandId: number, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<ApiResponse<AdminBrand>>(
      `${this.apiUrl}/backoffice/brands/${brandId}/logo`,
      formData,
    );
  }
}
