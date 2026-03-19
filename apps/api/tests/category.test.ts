import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyNumber } from './helpers.js';

async function cleanCatalog() {
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
}

let activeCatId: number;
let inactiveCatId: number;

beforeAll(async () => {
  await cleanCatalog();

  const active1 = await prisma.category.create({
    data: { name: 'GPUs', slug: 'gpus', description: 'Graphics cards' },
  });
  activeCatId = active1.id;

  await prisma.category.create({
    data: { name: 'CPUs', slug: 'cpus', description: 'Processors' },
  });

  await prisma.category.create({
    data: { name: 'RAM', slug: 'ram', description: 'Memory modules' },
  });

  await prisma.category.create({
    data: { name: 'SSDs', slug: 'ssds', description: 'Solid state drives' },
  });

  await prisma.category.create({
    data: { name: 'PSUs', slug: 'psus', description: 'Power supplies' },
  });

  const inactive = await prisma.category.create({
    data: { name: 'Archived', slug: 'archived', isActive: false },
  });
  inactiveCatId = inactive.id;
});

afterAll(async () => {
  await cleanCatalog();
  await prisma.$disconnect();
});

describe('GET /api/v1/categories', () => {
  it('lists only active categories', async () => {
    const res = await request(app).get('/api/v1/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination.total).toBe(5);
  });

  it('paginates correctly', async () => {
    const res = await request(app).get('/api/v1/categories?page=1&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  it('searches by name', async () => {
    const res = await request(app).get('/api/v1/categories?search=GPU');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('GPUs');
  });

  it('returns empty array when no matches', async () => {
    const res = await request(app).get('/api/v1/categories?search=nonexistent');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });
});

describe('GET /api/v1/categories/:categoryId', () => {
  it('returns active category detail', async () => {
    const res = await request(app).get(`/api/v1/categories/${activeCatId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(activeCatId);
    expect(res.body.data.name).toBe('GPUs');
    expect(res.body.data.slug).toBe('gpus');
    expect(res.body.data.description).toBe('Graphics cards');
  });

  it('returns 404 for nonexistent category', async () => {
    const res = await request(app).get('/api/v1/categories/99999');
    expect(res.status).toBe(404);
  });

  it('returns 404 for inactive category', async () => {
    const res = await request(app).get(`/api/v1/categories/${inactiveCatId}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app).get('/api/v1/categories/abc');
    expect(res.status).toBe(400);
  });
});
