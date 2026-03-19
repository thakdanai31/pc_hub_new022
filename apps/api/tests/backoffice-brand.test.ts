import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';

let adminToken: string;
let staffToken: string;
let customerToken: string;

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
  adminToken = await registerAndGetToken('admin-brand@test.com', 'ADMIN');
  staffToken = await registerAndGetToken('staff-brand@test.com', 'STAFF');
  customerToken = await registerAndGetToken('customer-brand@test.com', 'CUSTOMER');
});

afterAll(async () => {
  await cleanAll();
  await prisma.$disconnect();
});

describe('POST /api/v1/backoffice/brands', () => {
  it('admin creates brand', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NVIDIA', slug: 'nvidia' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('NVIDIA');
    expect(res.body.data.slug).toBe('nvidia');
    expect(res.body.data.isActive).toBe(true);
  });

  it('rejects duplicate slug with 409', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NVIDIA Copy', slug: 'nvidia' });

    expect(res.status).toBe(409);
  });

  it('staff cannot create (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'AMD', slug: 'amd' });

    expect(res.status).toBe(403);
  });

  it('customer cannot access (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Intel', slug: 'intel' });

    expect(res.status).toBe(403);
  });

  it('unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands')
      .send({ name: 'Intel', slug: 'intel' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/backoffice/brands', () => {
  it('staff lists all brands including inactive', async () => {
    await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'OldBrand', slug: 'old-brand', isActive: false });

    const res = await request(app)
      .get('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((b: Record<string, unknown>) => b.name);
    expect(names).toContain('OldBrand');
  });

  it('customer cannot list (403)', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/backoffice/brands/:brandId', () => {
  it('admin updates brand', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AMD', slug: 'amd' });

    const res = await request(app)
      .patch(`/api/v1/backoffice/brands/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AMD Radeon' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('AMD Radeon');
    expect(res.body.data.slug).toBe('amd');
  });

  it('returns 404 for nonexistent brand', async () => {
    const res = await request(app)
      .patch('/api/v1/backoffice/brands/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/backoffice/brands/:brandId', () => {
  it('admin deletes brand with no products', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete', slug: 'to-delete-brand' });

    const res = await request(app)
      .delete(`/api/v1/backoffice/brands/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('rejects delete when brand has products (409)', async () => {
    const brandRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'HasProducts', slug: 'has-products-brand' });

    const catRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'BrandDelCat', slug: 'brand-del-cat' });

    await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId: catRes.body.data.id,
        brandId: brandRes.body.data.id,
        name: 'Brand Del Product',
        slug: 'brand-del-product',
        sku: 'BDP-001',
        description: 'Test',
        price: 100,
        stock: 1,
      });

    const res = await request(app)
      .delete(`/api/v1/backoffice/brands/${brandRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('staff cannot delete (403)', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'StaffNoDel', slug: 'staff-no-del-brand' });

    const res = await request(app)
      .delete(`/api/v1/backoffice/brands/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/backoffice/brands/:brandId/toggle-active', () => {
  it('staff toggles brand active state', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toggleable', slug: 'toggle-brand' });

    const toggleRes = await request(app)
      .post(`/api/v1/backoffice/brands/${createRes.body.data.id}/toggle-active`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isActive).toBe(false);

    const toggleRes2 = await request(app)
      .post(`/api/v1/backoffice/brands/${createRes.body.data.id}/toggle-active`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(toggleRes2.body.data.isActive).toBe(true);
  });

  it('returns 404 for nonexistent brand', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/brands/99999/toggle-active')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(404);
  });
});
