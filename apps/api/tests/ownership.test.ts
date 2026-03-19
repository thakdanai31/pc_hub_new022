import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

// Two customers to test cross-user isolation
const CUSTOMER_A = {
  firstName: 'Alice',
  lastName: 'Owner',
  phoneNumber: '0811111111',
  email: 'alice-owner@test.com',
  password: 'password123',
};

const CUSTOMER_B = {
  firstName: 'Bob',
  lastName: 'Intruder',
  phoneNumber: '0822222222',
  email: 'bob-intruder@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Alice Owner',
  phoneNumber: '0811111111',
  line1: '100 Ownership St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let tokenA: string;
let tokenB: string;
let addressAId: number;
let addressBId: number;
let productId: number;
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

async function cleanOrders() {
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.update({ where: { id: productId }, data: { stock: 20 } });
}

beforeAll(async () => {
  await cleanDatabase();

  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER_A);
  tokenA = getBodyString(r1, 'data', 'accessToken');

  const r2 = await request(app).post('/api/v1/auth/register').send(CUSTOMER_B);
  tokenB = getBodyString(r2, 'data', 'accessToken');

  const a1 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${tokenA}`)
    .send(TEST_ADDRESS);
  addressAId = getBodyNumber(a1, 'data', 'id');

  const a2 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ ...TEST_ADDRESS, recipientName: 'Bob Intruder' });
  addressBId = getBodyNumber(a2, 'data', 'id');

  const cat = await prisma.category.create({
    data: { name: 'Ownership CPUs', slug: 'ownership-cpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Ownership Intel', slug: 'ownership-intel', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'i9-14900K', slug: 'i9-14900k-own', sku: 'OWN-I9-14900K',
      description: 'Ownership test CPU', price: 18900, stock: 20, isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Ownership enforcement — orders', () => {
  let orderAId: number;
  let orderANumber: string;

  beforeEach(async () => {
    await cleanOrders();

    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId, quantity: 1, addressId: addressAId, paymentMethod: 'COD' });
    orderAId = getBodyNumber(res, 'data', 'id');
    orderANumber = getBodyString(res, 'data', 'orderNumber');
  });

  it('Customer B cannot view Customer A order detail', async () => {
    const res = await request(app)
      .get(`/api/v1/account/orders/${orderAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('Customer B cannot view Customer A payment info', async () => {
    const res = await request(app)
      .get(`/api/v1/account/orders/${orderAId}/payment`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('Customer B cannot view Customer A checkout confirmation', async () => {
    const res = await request(app)
      .get(`/api/v1/checkout/confirmation/${orderANumber}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('Customer B order list does not include Customer A orders', async () => {
    const res = await request(app)
      .get('/api/v1/account/orders')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('Ownership enforcement — addresses', () => {
  it('Customer B cannot update Customer A address', async () => {
    const res = await request(app)
      .patch(`/api/v1/account/addresses/${addressAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ label: 'Hacked' });

    expect(res.status).toBe(404);
  });

  it('Customer B cannot delete Customer A address', async () => {
    const res = await request(app)
      .delete(`/api/v1/account/addresses/${addressAId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('Customer B cannot use Customer A address at checkout', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ productId, quantity: 1, addressId: addressAId, paymentMethod: 'COD' });

    expect(res.status).toBe(404);
  });
});

describe('Ownership enforcement — cart items', () => {
  it('Customer B cannot delete Customer A cart item', async () => {
    // Add item to A's cart
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId, quantity: 1 });
    const cartItemId = getBodyNumber(addRes, 'data', 'items', '0', 'id');

    const res = await request(app)
      .delete(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });

  it('Customer B cannot update Customer A cart item', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ productId, quantity: 1 });

    const cartA = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${tokenA}`);
    const cartItemId = cartA.body.data.items[0].id as number;

    const res = await request(app)
      .patch(`/api/v1/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(404);
  });
});
