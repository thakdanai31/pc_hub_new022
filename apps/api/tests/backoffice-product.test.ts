import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

let adminToken: string;
let staffToken: string;
let customerToken: string;
let categoryId: number;
let brandId: number;

async function cleanAll() {
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndGetToken(
  email: string,
  role: string,
): Promise<string> {
  await request(app).post('/api/v1/auth/register').send({
    firstName: role,
    lastName: 'User',
    email,
    phoneNumber: '0800000000',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });

  if (role !== 'CUSTOMER') {
    await prisma.user.update({
      where: { email },
      data: { role },
    });
  }

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'Password123!',
  });
  const token: unknown = loginRes.body?.data?.accessToken;
  if (typeof token !== 'string') throw new Error('Failed to get token');
  return token;
}

beforeAll(async () => {
  await cleanAll();
  adminToken = await registerAndGetToken('admin-prod@test.com', 'ADMIN');
  staffToken = await registerAndGetToken('staff-prod@test.com', 'STAFF');
  customerToken = await registerAndGetToken('customer-prod@test.com', 'CUSTOMER');

  // Seed category and brand for product tests
  const catRes = await request(app)
    .post('/api/v1/backoffice/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'GPUs', slug: 'gpus-prod' });
  categoryId = catRes.body.data.id;

  const brandRes = await request(app)
    .post('/api/v1/backoffice/brands')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'NVIDIA', slug: 'nvidia-prod' });
  brandId = brandRes.body.data.id;
});

afterAll(async () => {
  await cleanAll();
  await prisma.$disconnect();
});

describe('POST /api/v1/backoffice/products', () => {
  it('admin creates product', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'RTX 4090',
        slug: 'rtx-4090',
        sku: 'NV-4090',
        description: 'High-end GPU',
        price: 59990,
        stock: 5,
        warrantyMonths: 36,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('RTX 4090');
    expect(res.body.data.price).toBe(59990);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.category.name).toBe('GPUs');
    expect(res.body.data.brand.name).toBe('NVIDIA');
  });

  it('rejects duplicate slug with 409', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'RTX 4090 Copy',
        slug: 'rtx-4090',
        sku: 'NV-4090-COPY',
        description: 'Duplicate',
        price: 59990,
      });

    expect(res.status).toBe(409);
  });

  it('rejects duplicate sku with 409', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'RTX 4090 SKU Copy',
        slug: 'rtx-4090-sku-copy',
        sku: 'NV-4090',
        description: 'Duplicate SKU',
        price: 59990,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('SKU');
  });

  it('returns 404 for nonexistent categoryId', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId: 99999,
        brandId,
        name: 'No Cat',
        slug: 'no-cat',
        sku: 'NC-001',
        description: 'Test',
        price: 100,
      });

    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent brandId', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId: 99999,
        name: 'No Brand',
        slug: 'no-brand',
        sku: 'NB-001',
        description: 'Test',
        price: 100,
      });

    expect(res.status).toBe(404);
  });

  it('rejects non-positive price', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Free GPU',
        slug: 'free-gpu',
        sku: 'FREE-001',
        description: 'Test',
        price: 0,
      });

    expect(res.status).toBe(400);
  });

  it('rejects negative stock', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Negative Stock',
        slug: 'negative-stock',
        sku: 'NS-001',
        description: 'Test',
        price: 100,
        stock: -1,
      });

    expect(res.status).toBe(400);
  });

  it('staff cannot create (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Staff Product',
        slug: 'staff-product',
        sku: 'SP-001',
        description: 'Test',
        price: 100,
      });

    expect(res.status).toBe(403);
  });

  it('customer cannot access (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Customer Product',
        slug: 'customer-product',
        sku: 'CP-001',
        description: 'Test',
        price: 100,
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/backoffice/products', () => {
  it('staff lists all products including inactive', async () => {
    await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Inactive GPU',
        slug: 'inactive-gpu',
        sku: 'IG-001',
        description: 'Inactive',
        price: 1000,
        isActive: false,
      });

    const res = await request(app)
      .get('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((p: Record<string, unknown>) => p.name);
    expect(names).toContain('Inactive GPU');
  });

  it('filters by isActive', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/products?isActive=false')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    for (const p of res.body.data) {
      expect(p.isActive).toBe(false);
    }
  });

  it('customer cannot list (403)', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/backoffice/products/:productId', () => {
  it('admin updates product', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'RTX 4080',
        slug: 'rtx-4080',
        sku: 'NV-4080',
        description: 'GPU',
        price: 39990,
        stock: 10,
      });

    const res = await request(app)
      .patch(`/api/v1/backoffice/products/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 34990, stock: 15 });

    expect(res.status).toBe(200);
    expect(res.body.data.price).toBe(34990);
    expect(res.body.data.stock).toBe(15);
    expect(res.body.data.name).toBe('RTX 4080');
  });

  it('returns 404 for nonexistent product', async () => {
    const res = await request(app)
      .patch('/api/v1/backoffice/products/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent categoryId in update', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Update FK Test',
        slug: 'update-fk-test',
        sku: 'UFK-001',
        description: 'Test',
        price: 100,
      });

    const res = await request(app)
      .patch(`/api/v1/backoffice/products/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ categoryId: 99999 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/backoffice/products/:productId', () => {
  it('admin deletes product', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'To Delete',
        slug: 'to-delete-prod',
        sku: 'TD-001',
        description: 'Delete me',
        price: 100,
      });

    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for nonexistent product', async () => {
    const res = await request(app)
      .delete('/api/v1/backoffice/products/99999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('staff cannot delete (403)', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Staff No Del',
        slug: 'staff-no-del-prod',
        sku: 'SND-001',
        description: 'Test',
        price: 100,
      });

    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/backoffice/products/:productId/toggle-active', () => {
  it('staff toggles product active state', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Toggle Product',
        slug: 'toggle-prod',
        sku: 'TP-001',
        description: 'Test',
        price: 100,
      });

    const toggleRes = await request(app)
      .post(`/api/v1/backoffice/products/${createRes.body.data.id}/toggle-active`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isActive).toBe(false);
  });

  it('customer cannot toggle (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products/1/toggle-active')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});
