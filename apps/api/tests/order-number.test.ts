import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { generateOrderNumber } from '../src/modules/checkout/checkout.service.js';
import { getBodyString, getBodyNumber } from './helpers.js';

// --- Unit tests for generateOrderNumber ---

describe('generateOrderNumber', () => {
  it('produces PCH-YYYYMMDD-XXXXXXXX format with 8 hex chars', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^PCH-\d{8}-[0-9A-F]{8}$/);
  });

  it('uses current date in the date segment', () => {
    const orderNumber = generateOrderNumber();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    expect(orderNumber).toContain(today);
  });
});

// --- Integration test: order number collision retry ---

const CUSTOMER = {
  firstName: 'OrderNum',
  lastName: 'Tester',
  phoneNumber: '0899999999',
  email: 'ordernumtest@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'OrderNum Tester',
  phoneNumber: '0899999999',
  line1: '999 Test St',
  district: 'Test',
  subdistrict: 'Test',
  province: 'Bangkok',
  postalCode: '10100',
};

let token: string;
let addressId: number;
let productId: number;

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

  const r = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  token = getBodyString(r, 'data', 'accessToken');

  const a = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a, 'data', 'id');

  const cat = await prisma.category.create({
    data: { name: 'ON CPUs', slug: 'on-cpus', isActive: true },
  });

  const br = await prisma.brand.create({
    data: { name: 'ON AMD', slug: 'on-amd', isActive: true },
  });

  const p = await prisma.product.create({
    data: {
      categoryId: cat.id,
      brandId: br.id,
      name: 'ON Test CPU',
      slug: 'on-test-cpu',
      sku: 'ON-CPU-001',
      description: 'Order number test product',
      price: 5000,
      stock: 100,
      isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Order number collision retry', () => {
  beforeEach(async () => {
    await prisma.paymentSlip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.update({ where: { id: productId }, data: { stock: 100 } });
  });

  it('checkout succeeds even when first generated order number already exists', async () => {
    // Create an order to occupy a known order number
    const firstRes = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1, addressId, paymentMethod: 'COD' });

    expect(firstRes.status).toBe(201);
    const existingOrderNumber = getBodyString(firstRes, 'data', 'orderNumber');

    // Mock generateOrderNumber to return the colliding number on first call,
    // then a fresh number on second call
    const checkoutModule = await import('../src/modules/checkout/checkout.service.js');
    const originalFn = checkoutModule.generateOrderNumber;

    let callCount = 0;
    vi.spyOn(checkoutModule, 'generateOrderNumber').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return existingOrderNumber;
      }
      return originalFn();
    });

    // Second checkout should retry and succeed with a different order number
    const secondRes = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1, addressId, paymentMethod: 'COD' });

    expect(secondRes.status).toBe(201);
    const newOrderNumber = getBodyString(secondRes, 'data', 'orderNumber');
    expect(newOrderNumber).not.toBe(existingOrderNumber);

    vi.restoreAllMocks();
  });
});
