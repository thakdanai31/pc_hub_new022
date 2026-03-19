export interface ProductSummary {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: number;
  stock: number;
  warrantyMonths: number | null;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  image: string | null;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductDetail {
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
  images: ProductImage[];
}

export interface ProductFilters {
  search: string;
  categoryId: number | null;
  brandId: number | null;
  minPrice: string;
  maxPrice: string;
  sort: string;
  page: number;
}
