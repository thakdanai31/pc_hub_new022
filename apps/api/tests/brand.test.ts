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

let activeBrandId: number;
let inactiveBrandId: number;

beforeAll(async () => {
  await cleanCatalog();

  const active1 = await prisma.brand.create({
    data: { name: 'NVIDIA', slug: 'nvidia' },
  });
  activeBrandId = active1.id;

  await prisma.brand.create({
    data: { name: 'AMD', slug: 'amd' },
  });

  await prisma.brand.create({
    data: { name: 'Intel', slug: 'intel' },
  });

  const inactive = await prisma.brand.create({
    data: { name: 'OldBrand', slug: 'old-brand', isActive: false },
  });
  inactiveBrandId = inactive.id;
});

afterAll(async () => {
  await cleanCatalog();
  await prisma.$disconnect();
});

describe('GET /api/v1/brands', () => {
  it('lists only active brands', async () => {
    const res = await request(app).get('/api/v1/brands');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('paginates correctly', async () => {
    const res = await request(app).get('/api/v1/brands?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('searches by name', async () => {
    const res = await request(app).get('/api/v1/brands?search=NVIDIA');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('NVIDIA');
  });
});

describe('GET /api/v1/brands/:brandId', () => {
  it('returns active brand detail', async () => {
    const res = await request(app).get(`/api/v1/brands/${activeBrandId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(activeBrandId);
    expect(res.body.data.name).toBe('NVIDIA');
    expect(res.body.data.slug).toBe('nvidia');
  });

  it('returns 404 for nonexistent brand', async () => {
    const res = await request(app).get('/api/v1/brands/99999');
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive brand', async () => {
    const res = await request(app).get(`/api/v1/brands/${inactiveBrandId}`);
    expect(res.status).toBe(404);
  });
});
