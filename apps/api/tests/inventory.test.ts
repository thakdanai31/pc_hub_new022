import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyArray, getBodyNumber, getBodyString } from './helpers.js';

const CUSTOMER = {
  firstName: 'Inventory',
  lastName: 'Customer',
  phoneNumber: '0810001000',
  email: 'inventory-customer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Inventory',
  lastName: 'Staff',
  phoneNumber: '0820002000',
  email: 'inventory-staff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'Inventory',
  lastName: 'Admin',
  phoneNumber: '0830003000',
  email: 'inventory-admin@test.com',
  password: 'password123',
};

let customerToken: string;
let staffToken: string;
let adminToken: string;
let productId: number;
let categoryId: number;
let brandId: number;

async function clearClaimsIfTableExists() {
  try {
    await prisma.claim.deleteMany();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2021'
    ) {
      return;
    }

    throw error;
  }
}

async function cleanDatabase() {
  await clearClaimsIfTableExists();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

async function registerAndGetToken(userData: typeof CUSTOMER) {
  const res = await request(app).post('/api/v1/auth/register').send(userData);

  return {
    token: getBodyString(res, 'data', 'accessToken'),
    userId: getBodyNumber(res, 'data', 'user', 'id'),
  };
}

async function promoteAndReLogin(
  email: string,
  password: string,
  role: 'STAFF' | 'ADMIN',
) {
  await prisma.user.update({
    where: { email },
    data: { role },
  });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return getBodyString(res, 'data', 'accessToken');
}

beforeAll(async () => {
  await cleanDatabase();

  const customer = await registerAndGetToken(CUSTOMER);
  customerToken = customer.token;

  const staff = await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');

  const admin = await registerAndGetToken(ADMIN);
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');

  const category = await prisma.category.create({
    data: {
      name: 'Inventory Cases',
      slug: 'inventory-cases',
      isActive: true,
    },
  });
  categoryId = category.id;

  const brand = await prisma.brand.create({
    data: {
      name: 'Lian Li',
      slug: 'lian-li',
      isActive: true,
    },
  });
  brandId = brand.id;

  const product = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'Lian Li O11 Dynamic EVO',
      slug: 'lian-li-o11-dynamic-evo',
      sku: 'CASE-LIANLI-O11-EVO',
      description: 'Inventory test case',
      price: 5990,
      stock: 10,
      isActive: true,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearClaimsIfTableExists();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.update({
    where: { id: productId },
    data: { stock: 10 },
  });
});

describe('Inventory management', () => {
  it('staff can restock a product and create an inventory transaction', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/restock`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 5, note: 'Received supplier shipment', referenceId: 101 });

    expect(res.status).toBe(201);
    expect(res.body.data.product.stock).toBe(15);
    expect(res.body.data.transaction.type).toBe('RESTOCK');
    expect(res.body.data.transaction.quantity).toBe(5);
    expect(res.body.data.transaction.referenceId).toBe(101);

    const tx = await prisma.inventoryTransaction.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    expect(tx).toHaveLength(1);
    expect(tx[0]?.type).toBe('RESTOCK');
    expect(tx[0]?.note).toBe('Received supplier shipment');
  });

  it('admin can adjust inventory in', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/adjust-in`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 3, note: 'Manual recount correction' });

    expect(res.status).toBe(201);
    expect(res.body.data.product.stock).toBe(13);
    expect(res.body.data.transaction.type).toBe('ADJUSTMENT_IN');
  });

  it('staff can adjust inventory out', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/adjust-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 4, note: 'Damaged during handling' });

    expect(res.status).toBe(201);
    expect(res.body.data.product.stock).toBe(6);
    expect(res.body.data.transaction.type).toBe('ADJUSTMENT_OUT');
  });

  it('rejects adjustment out when stock is insufficient', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/adjust-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 99, note: 'Impossible adjustment' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects invalid inventory quantity', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/restock`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 0, note: 'Invalid restock quantity' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(product?.stock).toBe(10);

    const txCount = await prisma.inventoryTransaction.count({
      where: { productId },
    });
    expect(txCount).toBe(0);
  });

  it('rejects customer access to inventory mutations', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/restock`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1, note: 'Should not be allowed' });

    expect(res.status).toBe(403);
  });

  it('lists inventory transactions with filters', async () => {
    await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/restock`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 5, note: 'Restock batch A', referenceId: 201 });

    await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/adjust-out`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 2, note: 'Write-off batch A', referenceId: 202 });

    const res = await request(app)
      .get('/api/v1/backoffice/inventory')
      .query({ type: 'RESTOCK', productId })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeTruthy();
    const data = getBodyArray(res, 'data');
    expect(data).toHaveLength(1);
    const row = data[0] as Record<string, unknown>;
    expect(row['type']).toBe('RESTOCK');
  });

  it('lists product-specific inventory history', async () => {
    await request(app)
      .post(`/api/v1/backoffice/inventory/products/${productId}/restock`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ quantity: 2, note: 'Restock batch B' });

    const res = await request(app)
      .get(`/api/v1/backoffice/inventory/products/${productId}/transactions`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeTruthy();
    const data = getBodyArray(res, 'data');
    expect(data).toHaveLength(1);
    const row = data[0] as Record<string, unknown>;
    expect(row['productId']).toBe(productId);
  });
});
