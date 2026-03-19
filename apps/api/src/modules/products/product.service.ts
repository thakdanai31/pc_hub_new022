import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../common/errors.js';
import { buildPaginationMeta } from '../../common/pagination.js';
import type { ProductListQuery } from './product.schema.js';
import type { Prisma } from '../../generated/prisma/client.js';

const sortMap = {
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  name_asc: { name: 'asc' },
  name_desc: { name: 'desc' },
} as const;

interface ProductSummary {
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

interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  warrantyMonths: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  images: Array<{
    id: number;
    imageUrl: string;
    altText: string | null;
    sortOrder: number;
  }>;
}

const listSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  stock: true,
  warrantyMonths: true,
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: {
    select: { imageUrl: true },
    orderBy: { sortOrder: 'asc' } satisfies Prisma.ProductImageOrderByWithRelationInput,
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const detailSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  description: true,
  price: true,
  stock: true,
  warrantyMonths: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  images: {
    select: {
      id: true,
      imageUrl: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' } satisfies Prisma.ProductImageOrderByWithRelationInput,
  },
} satisfies Prisma.ProductSelect;

export async function listProducts(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (query.search) {
    where.name = { contains: query.search };
  }
  if (query.categoryId !== undefined) {
    // Include products in this category AND all child categories
    const childCategories = await prisma.category.findMany({
      where: { parentId: query.categoryId, isActive: true },
      select: { id: true },
    });
    const categoryIds = [query.categoryId, ...childCategories.map((c) => c.id)];
    where.categoryId = { in: categoryIds };
  }
  if (query.brandId !== undefined) {
    where.brandId = query.brandId;
  }

  const priceFilter: Prisma.DecimalFilter = {};
  if (query.minPrice !== undefined) {
    priceFilter.gte = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    priceFilter.lte = query.maxPrice;
  }
  if (Object.keys(priceFilter).length > 0) {
    where.price = priceFilter;
  }

  const orderBy = sortMap[query.sort];

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: listSelect,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const data: ProductSummary[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    price: Number(row.price),
    stock: row.stock,
    warrantyMonths: row.warrantyMonths,
    category: row.category,
    brand: row.brand,
    image: row.images[0]?.imageUrl ?? null,
  }));

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function getProductById(productId: number): Promise<ProductDetail> {
  const row = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: detailSelect,
  });

  if (!row) {
    throw new NotFoundError('Product not found');
  }

  return {
    ...row,
    price: Number(row.price),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const row = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: detailSelect,
  });

  if (!row) {
    throw new NotFoundError('Product not found');
  }

  return {
    ...row,
    price: Number(row.price),
  };
}
