import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

const CUSTOMER = {
  firstName: 'Checkout',
  lastName: 'User',
  phoneNumber: '0833333333',
  email: 'checkoutuser@test.com',
  password: 'password123',
};

const CUSTOMER_2 = {
  firstName: 'Other',
  lastName: 'Checkout',
  phoneNumber: '0844444444',
  email: 'othercheckout@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Checkout User',
  phoneNumber: '0833333333',
  line1: '123 Main St',
  district: 'Chatuchak',
  subdistrict: 'Chatuchak',
  province: 'Bangkok',
  postalCode: '10900',
};

let token: string;
let token2: string;
let addressId: number;
let address2Id: number;
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

  // Create addresses
  const a1 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a1, 'data', 'id');

  const a2 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${token2}`)
    .send({ ...TEST_ADDRESS, recipientName: 'Other User' });
  address2Id = getBodyNumber(a2, 'data', 'id');

  // Create category and brand
  const cat = await prisma.category.create({
    data: { name: 'GPUs', slug: 'gpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'NVIDIA', slug: 'nvidia', isActive: true },
  });
  brandId = br.id;

  // Create products
  const p1 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'RTX 4090',
      slug: 'rtx-4090',
      sku: 'GPU-RTX-4090',
      description: 'High-end GPU',
      price: 59900,
      stock: 5,
      isActive: true,
    },
  });
  productId = p1.id;

  const p2 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'RTX 4070',
      slug: 'rtx-4070',
      sku: 'GPU-RTX-4070',
      description: 'Mid-range GPU',
      price: 21900,
      stock: 3,
      isActive: true,
    },
  });
  product2Id = p2.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/checkout/cart', () => {
  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.paymentSlip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    // Restore stock
    await prisma.product.update({ where: { id: productId }, data: { stock: 5, isActive: true } });
    await prisma.product.update({ where: { id: product2Id }, data: { stock: 3, isActive: true } });
    await prisma.category.update({ where: { id: categoryId }, data: { isActive: true } });
    await prisma.brand.update({ where: { id: brandId }, data: { isActive: true } });
  });

  it('creates a COD order from cart', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.paymentMethod).toBe('COD');
    expect(res.body.data.orderNumber).toMatch(/^PCH-/);
    expect(res.body.data.totalAmount).toBe(119800);
  });

  it('creates a PROMPTPAY_QR order with AWAITING_PAYMENT status', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'PROMPTPAY_QR' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('AWAITING_PAYMENT');
    expect(res.body.data.paymentMethod).toBe('PROMPTPAY_QR');
  });

  it('decrements stock after checkout', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(3);
  });

  it('clears cart after checkout', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    const cartRes = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(cartRes.body.data.items).toEqual([]);
  });

  it('stores address snapshot', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    const order = await prisma.order.findUnique({
      where: { orderNumber: res.body.data.orderNumber as string },
    });

    const snapshot = order?.addressSnapshot as Record<string, unknown>;
    expect(snapshot['recipientName']).toBe('Checkout User');
    expect(snapshot['province']).toBe('Bangkok');
  });

  it('stores product snapshot', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    const items = await prisma.orderItem.findMany({
      where: { order: { orderNumber: res.body.data.orderNumber as string } },
    });

    expect(items).toHaveLength(1);
    const snapshot = items[0]?.productSnapshot as Record<string, unknown>;
    expect(snapshot['name']).toBe('RTX 4090');
    expect(snapshot['sku']).toBe('GPU-RTX-4090');
  });

  it('rejects empty cart', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPTY_CART');
  });

  it('rejects when address not owned', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address2Id, paymentMethod: 'COD' });

    expect(res.status).toBe(404);
  });

  it('rejects when product became inactive', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CHECKOUT_VALIDATION_FAILED');
    expect(res.body.invalidItems).toBeDefined();
  });

  it('rejects when stock is insufficient', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 3 });

    // Reduce stock below cart quantity
    await prisma.product.update({ where: { id: productId }, data: { stock: 1 } });

    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CHECKOUT_VALIDATION_FAILED');
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/cart')
      .send({ addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/checkout/buy-now', () => {
  beforeEach(async () => {
    await prisma.paymentSlip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.update({ where: { id: productId }, data: { stock: 5, isActive: true } });
    await prisma.product.update({ where: { id: product2Id }, data: { stock: 3, isActive: true } });
    await prisma.category.update({ where: { id: categoryId }, data: { isActive: true } });
    await prisma.brand.update({ where: { id: brandId }, data: { isActive: true } });
  });

  it('creates an order for a single product', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1,
        addressId,
        paymentMethod: 'COD',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toMatch(/^PCH-/);
    expect(res.body.data.totalAmount).toBe(59900);
  });

  it('decrements stock', async () => {
    await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 2,
        addressId,
        paymentMethod: 'COD',
      });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stock).toBe(3);
  });

  it('rejects non-existent product', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 999999,
        quantity: 1,
        addressId,
        paymentMethod: 'COD',
      });

    expect(res.status).toBe(404);
  });

  it('rejects inactive product', async () => {
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });

    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1,
        addressId,
        paymentMethod: 'COD',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('rejects when quantity exceeds stock', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 99,
        addressId,
        paymentMethod: 'COD',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects address not owned by user', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1,
        addressId: address2Id,
        paymentMethod: 'COD',
      });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/checkout/confirmation/:orderNumber', () => {
  let orderNumber: string;

  beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.paymentSlip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.update({ where: { id: productId }, data: { stock: 5 } });

    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1,
        addressId,
        paymentMethod: 'COD',
      });

    orderNumber = getBodyString(res, 'data', 'orderNumber');
  });

  it('returns order confirmation for owner', async () => {
    const res = await request(app)
      .get(`/api/v1/checkout/confirmation/${orderNumber}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe(orderNumber);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.paymentMethod).toBe('COD');
    expect(res.body.data.totalAmount).toBe(59900);
  });

  it('returns 404 for non-owner', async () => {
    const res = await request(app)
      .get(`/api/v1/checkout/confirmation/${orderNumber}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/v1/checkout/confirmation/PCH-00000000-XXXX')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
