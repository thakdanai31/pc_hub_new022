import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

async function cleanCatalog() {
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
}

let categoryId: number;
let category2Id: number;
let brandId: number;
let brand2Id: number;
let cheapProductId: number;
let midProductSlug: string;
let inactiveProductId: number;

beforeAll(async () => {
  await cleanCatalog();

  const cat1 = await prisma.category.create({
    data: { name: 'GPUs', slug: 'gpus' },
  });
  categoryId = cat1.id;

  const cat2 = await prisma.category.create({
    data: { name: 'CPUs', slug: 'cpus' },
  });
  category2Id = cat2.id;

  const b1 = await prisma.brand.create({
    data: { name: 'NVIDIA', slug: 'nvidia' },
  });
  brandId = b1.id;

  const b2 = await prisma.brand.create({
    data: { name: 'AMD', slug: 'amd' },
  });
  brand2Id = b2.id;

  // Cheap GPU
  const cheap = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'GTX 1650',
      slug: 'gtx-1650',
      sku: 'NV-1650',
      description: 'Entry-level GPU',
      price: 5990,
      stock: 10,
      warrantyMonths: 36,
    },
  });
  cheapProductId = cheap.id;

  // Add images to cheap product
  await prisma.productImage.createMany({
    data: [
      {
        productId: cheap.id,
        imageUrl: 'https://img.example.com/1650-front.jpg',
        imagePublicId: '1650-front',
        altText: 'GTX 1650 front',
        sortOrder: 0,
      },
      {
        productId: cheap.id,
        imageUrl: 'https://img.example.com/1650-back.jpg',
        imagePublicId: '1650-back',
        altText: 'GTX 1650 back',
        sortOrder: 1,
      },
    ],
  });

  // Mid-range GPU
  const mid = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'RTX 4070',
      slug: 'rtx-4070',
      sku: 'NV-4070',
      description: 'Mid-range GPU',
      price: 19990,
      stock: 5,
      warrantyMonths: 36,
    },
  });
  midProductSlug = mid.slug;

  // CPU from different category/brand
  await prisma.product.create({
    data: {
      categoryId: category2Id,
      brandId: brand2Id,
      name: 'Ryzen 7 7800X3D',
      slug: 'ryzen-7-7800x3d',
      sku: 'AMD-7800X3D',
      description: 'High-end gaming CPU',
      price: 12990,
      stock: 8,
    },
  });

  // Inactive product
  const inactive = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'Old GPU',
      slug: 'old-gpu',
      sku: 'NV-OLD',
      description: 'Discontinued',
      price: 2990,
      stock: 0,
      isActive: false,
    },
  });
  inactiveProductId = inactive.id;
});

afterAll(async () => {
  await cleanCatalog();
  await prisma.$disconnect();
});

describe('GET /api/v1/products', () => {
  it('lists only active products', async () => {
    const res = await request(app).get('/api/v1/products');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('includes category, brand, and first image', async () => {
    const res = await request(app).get('/api/v1/products');
    const gtx = res.body.data.find(
      (p: Record<string, unknown>) => p.sku === 'NV-1650',
    );

    expect(gtx).toBeDefined();
    expect(gtx.category.name).toBe('GPUs');
    expect(gtx.brand.name).toBe('NVIDIA');
    expect(gtx.image).toBe('https://img.example.com/1650-front.jpg');
    expect(typeof gtx.price).toBe('number');
    expect(gtx.price).toBe(5990);
  });

  it('returns null image for products without images', async () => {
    const res = await request(app).get('/api/v1/products');
    const ryzen = res.body.data.find(
      (p: Record<string, unknown>) => p.sku === 'AMD-7800X3D',
    );

    expect(ryzen.image).toBeNull();
  });

  it('filters by categoryId', async () => {
    const res = await request(app).get(
      `/api/v1/products?categoryId=${categoryId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const p of res.body.data) {
      expect(p.category.id).toBe(categoryId);
    }
  });

  it('filters by brandId', async () => {
    const res = await request(app).get(`/api/v1/products?brandId=${brand2Id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].brand.name).toBe('AMD');
  });

  it('filters by price range', async () => {
    const res = await request(app).get(
      '/api/v1/products?minPrice=10000&maxPrice=20000',
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const p of res.body.data) {
      expect(p.price).toBeGreaterThanOrEqual(10000);
      expect(p.price).toBeLessThanOrEqual(20000);
    }
  });

  it('searches by name', async () => {
    const res = await request(app).get('/api/v1/products?search=RTX');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('RTX 4070');
  });

  it('sorts by price ascending', async () => {
    const res = await request(app).get('/api/v1/products?sort=price_asc');

    expect(res.status).toBe(200);
    const prices = res.body.data.map((p: Record<string, unknown>) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('sorts by price descending', async () => {
    const res = await request(app).get('/api/v1/products?sort=price_desc');

    expect(res.status).toBe(200);
    const prices = res.body.data.map((p: Record<string, unknown>) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it('paginates correctly', async () => {
    const res = await request(app).get('/api/v1/products?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

describe('GET /api/v1/products/:productId', () => {
  it('returns product detail with full image array', async () => {
    const res = await request(app).get(
      `/api/v1/products/${cheapProductId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(cheapProductId);
    expect(res.body.data.name).toBe('GTX 1650');
    expect(res.body.data.description).toBe('Entry-level GPU');
    expect(res.body.data.price).toBe(5990);
    expect(res.body.data.category.name).toBe('GPUs');
    expect(res.body.data.brand.name).toBe('NVIDIA');
    expect(res.body.data.images).toHaveLength(2);
    expect(res.body.data.images[0].sortOrder).toBe(0);
    expect(res.body.data.images[1].sortOrder).toBe(1);
  });

  it('returns 404 for nonexistent product', async () => {
    const res = await request(app).get('/api/v1/products/99999');
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive product', async () => {
    const res = await request(app).get(
      `/api/v1/products/${inactiveProductId}`,
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/products/slug/:slug', () => {
  it('returns product detail by slug', async () => {
    const res = await request(app).get(
      `/api/v1/products/slug/${midProductSlug}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('rtx-4070');
    expect(res.body.data.name).toBe('RTX 4070');
    expect(typeof res.body.data.price).toBe('number');
  });

  it('returns 404 for nonexistent slug', async () => {
    const res = await request(app).get('/api/v1/products/slug/no-such-product');
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive product slug', async () => {
    const res = await request(app).get('/api/v1/products/slug/old-gpu');
    expect(res.status).toBe(404);
  });
});
