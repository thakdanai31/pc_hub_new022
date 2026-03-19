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
  const res = await request(app).post('/api/v1/auth/register').send({
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
    // Re-login to get token with updated role
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email,
      password: 'Password123!',
    });
    const token: unknown = loginRes.body?.data?.accessToken;
    if (typeof token !== 'string') throw new Error('Failed to get token');
    return token;
  }

  const token: unknown = res.body?.data?.accessToken;
  if (typeof token !== 'string') throw new Error('Failed to get token');
  return token;
}

beforeAll(async () => {
  await cleanAll();
  adminToken = await registerAndGetToken('admin-cat@test.com', 'ADMIN');
  staffToken = await registerAndGetToken('staff-cat@test.com', 'STAFF');
  customerToken = await registerAndGetToken('customer-cat@test.com', 'CUSTOMER');
});

afterAll(async () => {
  await cleanAll();
  await prisma.$disconnect();
});

describe('POST /api/v1/backoffice/categories', () => {
  it('admin creates category', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'GPUs', slug: 'gpus', description: 'Graphics cards' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('GPUs');
    expect(res.body.data.slug).toBe('gpus');
    expect(res.body.data.isActive).toBe(true);
  });

  it('rejects duplicate slug with 409', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'GPUs Again', slug: 'gpus' });

    expect(res.status).toBe(409);
  });

  it('creates category with parentId', async () => {
    const parent = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Components', slug: 'components' });

    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sub Components',
        slug: 'sub-components',
        parentId: parent.body.data.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.parentId).toBe(parent.body.data.id);
  });

  it('returns 404 for nonexistent parentId', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Orphan', slug: 'orphan', parentId: 99999 });

    expect(res.status).toBe(404);
  });

  it('staff cannot create (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'RAM', slug: 'ram' });

    expect(res.status).toBe(403);
  });

  it('customer cannot access (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'RAM', slug: 'ram' });

    expect(res.status).toBe(403);
  });

  it('unauthenticated returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .send({ name: 'RAM', slug: 'ram' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/backoffice/categories', () => {
  it('staff lists all categories including inactive', async () => {
    // Create inactive category
    await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Archived', slug: 'archived', isActive: false });

    const res = await request(app)
      .get('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((c: Record<string, unknown>) => c.name);
    expect(names).toContain('Archived');
  });

  it('customer cannot list (403)', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/backoffice/categories/:categoryId', () => {
  it('admin updates category', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Monitors', slug: 'monitors' });

    const res = await request(app)
      .patch(`/api/v1/backoffice/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Displays', description: 'Monitor displays' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Displays');
    expect(res.body.data.slug).toBe('monitors');
  });

  it('returns 404 for nonexistent category', async () => {
    const res = await request(app)
      .patch('/api/v1/backoffice/categories/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  it('rejects self-referencing parentId', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Self Ref', slug: 'self-ref' });

    const res = await request(app)
      .patch(`/api/v1/backoffice/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ parentId: createRes.body.data.id });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/v1/backoffice/categories/:categoryId', () => {
  it('admin deletes category with no products', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'To Delete', slug: 'to-delete' });

    const res = await request(app)
      .delete(`/api/v1/backoffice/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('rejects delete when category has products (409)', async () => {
    const catRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Has Products', slug: 'has-products' });

    const brandRes = await request(app)
      .post('/api/v1/backoffice/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TestBrand', slug: 'testbrand-catdel' });

    await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId: catRes.body.data.id,
        brandId: brandRes.body.data.id,
        name: 'Test Product',
        slug: 'test-product-catdel',
        sku: 'TP-CATDEL',
        description: 'Test',
        price: 100,
        stock: 1,
      });

    const res = await request(app)
      .delete(`/api/v1/backoffice/categories/${catRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('rejects delete when category has children (409)', async () => {
    const parentRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Parent Del', slug: 'parent-del' });

    await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Child Del', slug: 'child-del', parentId: parentRes.body.data.id });

    const res = await request(app)
      .delete(`/api/v1/backoffice/categories/${parentRes.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it('staff cannot delete (403)', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Staff No Del', slug: 'staff-no-del' });

    const res = await request(app)
      .delete(`/api/v1/backoffice/categories/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/backoffice/categories/:categoryId/toggle-active', () => {
  it('staff toggles category active state', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toggleable', slug: 'toggleable' });

    expect(createRes.body.data.isActive).toBe(true);

    const toggleRes = await request(app)
      .post(`/api/v1/backoffice/categories/${createRes.body.data.id}/toggle-active`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(toggleRes.status).toBe(200);
    expect(toggleRes.body.data.isActive).toBe(false);

    const toggleRes2 = await request(app)
      .post(`/api/v1/backoffice/categories/${createRes.body.data.id}/toggle-active`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(toggleRes2.body.data.isActive).toBe(true);
  });

  it('returns 404 for nonexistent category', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories/99999/toggle-active')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(404);
  });

  it('customer cannot toggle (403)', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/categories/1/toggle-active')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});
