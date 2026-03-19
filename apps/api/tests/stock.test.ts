import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

const CUSTOMER = {
  firstName: 'Stock',
  lastName: 'Tester',
  phoneNumber: '0811113333',
  email: 'stock-tester@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Stock Tester',
  phoneNumber: '0811113333',
  line1: '300 Stock St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let staffToken: string;
let addressId: number;
let productAId: number;
let productBId: number;
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
  await prisma.product.update({ where: { id: productAId }, data: { stock: 10 } });
  await prisma.product.update({ where: { id: productBId }, data: { stock: 5 } });
}

beforeAll(async () => {
  await cleanDatabase();

  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  customerToken = getBodyString(r1, 'data', 'accessToken');

  // Create staff
  await request(app).post('/api/v1/auth/register').send({
    ...CUSTOMER,
    email: 'stock-staff@test.com',
  });
  await prisma.user.update({
    where: { email: 'stock-staff@test.com' },
    data: { role: 'STAFF' },
  });
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: 'stock-staff@test.com',
    password: 'password123',
  });
  staffToken = getBodyString(loginRes, 'data', 'accessToken');

  const a = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a, 'data', 'id');

  const cat = await prisma.category.create({
    data: { name: 'Stock GPUs', slug: 'stock-gpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Stock NVIDIA', slug: 'stock-nvidia', isActive: true },
  });
  brandId = br.id;

  const pA = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Stock GPU A', slug: 'stock-gpu-a', sku: 'STK-A-001',
      description: 'Stock test A', price: 20000, stock: 10, isActive: true,
    },
  });
  productAId = pA.id;

  const pB = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Stock GPU B', slug: 'stock-gpu-b', sku: 'STK-B-001',
      description: 'Stock test B', price: 15000, stock: 5, isActive: true,
    },
  });
  productBId = pB.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Stock decrement on checkout', () => {
  beforeEach(cleanOrders);

  it('buy-now decrements stock by exact quantity', async () => {
    const stockBefore = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;

    await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: 3, addressId, paymentMethod: 'COD' });

    const stockAfter = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    expect(stockAfter).toBe(stockBefore - 3);
  });

  it('checkout with exact remaining stock succeeds', async () => {
    // Stock is 10, buy all 10
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: 10, addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(201);

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product!.stock).toBe(0);
  });

  it('checkout exceeding stock fails and stock remains unchanged', async () => {
    const stockBefore = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;

    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: stockBefore + 1, addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');

    const stockAfter = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    expect(stockAfter).toBe(stockBefore);
  });
});

describe('Stock restoration on rejection', () => {
  beforeEach(cleanOrders);

  it('rejecting COD order restores stock', async () => {
    const qty = 4;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });

    const orderId = getBodyNumber(res, 'data', 'id');
    const stockAfterCheckout = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    expect(stockAfterCheckout).toBe(10 - qty);

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Stock test rejection' });

    const stockAfterReject = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    expect(stockAfterReject).toBe(10);
  });

  it('rejecting PromptPay order restores stock', async () => {
    const qty = 3;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'PROMPTPAY_QR' });

    const orderId = getBodyNumber(res, 'data', 'id');

    // Move to PAYMENT_REVIEW so it can be rejected
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' } });
    await prisma.payment.updateMany({ where: { orderId }, data: { status: 'PENDING_REVIEW' } });

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'PromptPay stock test rejection' });

    const stockAfterReject = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    expect(stockAfterReject).toBe(10);
  });

  it('multi-item order rejection restores all items stock', async () => {
    // Add two products to cart then checkout
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: 2 });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productBId, quantity: 3 });

    const checkoutRes = await request(app)
      .post('/api/v1/checkout/cart')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ addressId, paymentMethod: 'COD' });

    expect(checkoutRes.status).toBe(201);
    const orderId = getBodyNumber(checkoutRes, 'data', 'id');

    const stockAAfterCheckout = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    const stockBAfterCheckout = (await prisma.product.findUnique({ where: { id: productBId } }))!.stock;
    expect(stockAAfterCheckout).toBe(8);
    expect(stockBAfterCheckout).toBe(2);

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Multi-item rejection test' });

    const stockAAfterReject = (await prisma.product.findUnique({ where: { id: productAId } }))!.stock;
    const stockBAfterReject = (await prisma.product.findUnique({ where: { id: productBId } }))!.stock;
    expect(stockAAfterReject).toBe(10);
    expect(stockBAfterReject).toBe(5);
  });
});
