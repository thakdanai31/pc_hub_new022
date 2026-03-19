import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getBodyArray } from './helpers.js';

const CUSTOMER = {
  firstName: 'Cart',
  lastName: 'User',
  phoneNumber: '0811111111',
  email: 'cartuser@test.com',
  password: 'password123',
};

const CUSTOMER_2 = {
  firstName: 'Other',
  lastName: 'User',
  phoneNumber: '0822222222',
  email: 'otheruser@test.com',
  password: 'password123',
};

let token: string;
let token2: string;
let productId: number;
let product2Id: number;
let categoryId: number;
let brandId: number;

async function cleanDatabase() {
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

beforeAll(async () => {
  await cleanDatabase();

  // Register customers
  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  token = getBodyString(r1, 'data', 'accessToken');
  const r2 = await request(app).post('/api/v1/auth/register').send(CUSTOMER_2);
  token2 = getBodyString(r2, 'data', 'accessToken');

  // Create category and brand via Prisma (admin-level seed)
  const cat = await prisma.category.create({
    data: { name: 'CPUs', slug: 'cpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'AMD', slug: 'amd', isActive: true },
  });
  brandId = br.id;

  // Create products
  const p1 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'AMD Ryzen 9 7950X',
      slug: 'amd-ryzen-9-7950x',
      sku: 'CPU-AMD-7950X',
      description: 'High-end processor',
      price: 19900,
      stock: 10,
      isActive: true,
    },
  });
  productId = p1.id;

  const p2 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'AMD Ryzen 5 7600X',
      slug: 'amd-ryzen-5-7600x',
      sku: 'CPU-AMD-7600X',
      description: 'Mid-range processor',
      price: 8990,
      stock: 5,
      isActive: true,
    },
  });
  product2Id = p2.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/v1/cart', () => {
  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
  });

  it('returns empty cart for new user', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/cart/items', () => {
  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
  });

  it('adds a product to cart', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(201);
    const items = getBodyArray(res, 'data', 'items');
    expect(items).toHaveLength(1);
  });

  it('increments quantity for existing item', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 3 });

    expect(res.status).toBe(201);
    const items = getBodyArray(res, 'data', 'items');
    expect(items).toHaveLength(1);
    const item = items[0] as Record<string, unknown>;
    expect(item['quantity']).toBe(5);
  });

  it('rejects when quantity exceeds stock', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 99 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects non-existent product', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 999999, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('rejects inactive product', async () => {
    await prisma.product.update({ where: { id: product2Id }, data: { isActive: false } });

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product2Id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRODUCT_UNAVAILABLE');

    await prisma.product.update({ where: { id: product2Id }, data: { isActive: true } });
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 'abc' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/cart/items/:cartItemId', () => {
  let cartItemId: number;

  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const items = getBodyArray(res, 'data', 'items');
    const item = items[0] as Record<string, unknown>;
    cartItemId = item['id'] as number;
  });

  it('updates quantity', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    const items = getBodyArray(res, 'data', 'items');
    const item = items[0] as Record<string, unknown>;
    expect(item['quantity']).toBe(5);
  });

  it('rejects when quantity exceeds stock', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 99 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('returns 404 for other user cart item', async () => {
    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await request(app)
      .patch('/api/v1/cart/items/999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/cart/items/:cartItemId', () => {
  let cartItemId: number;

  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();

    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const items = getBodyArray(res, 'data', 'items');
    const item = items[0] as Record<string, unknown>;
    cartItemId = item['id'] as number;
  });

  it('removes item from cart', async () => {
    const res = await request(app)
      .delete(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('returns 404 for other user cart item', async () => {
    const res = await request(app)
      .delete(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/cart', () => {
  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
  });

  it('clears all items from cart', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product2Id, quantity: 1 });

    const res = await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('succeeds on already empty cart', async () => {
    const res = await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
