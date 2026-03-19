import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

let customerToken: string;
let adminToken: string;
let addressId: number;
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

beforeAll(async () => {
  await cleanDatabase();

  // Customer
  const r1 = await request(app).post('/api/v1/auth/register').send({
    firstName: 'Val',
    lastName: 'Customer',
    phoneNumber: '0811114444',
    email: 'val-customer@test.com',
    password: 'password123',
  });
  customerToken = getBodyString(r1, 'data', 'accessToken');

  // Admin via register + role update + re-login
  await request(app).post('/api/v1/auth/register').send({
    firstName: 'Val',
    lastName: 'Admin',
    phoneNumber: '0811115555',
    email: 'val-admin@test.com',
    password: 'password123',
  });
  await prisma.user.update({
    where: { email: 'val-admin@test.com' },
    data: { role: 'ADMIN' },
  });
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: 'val-admin@test.com',
    password: 'password123',
  });
  adminToken = getBodyString(loginRes, 'data', 'accessToken');

  // Address
  const a = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      label: 'Home',
      recipientName: 'Val Customer',
      phoneNumber: '0811114444',
      line1: '400 Validation St',
      district: 'Bangrak',
      subdistrict: 'Bangrak',
      province: 'Bangkok',
      postalCode: '10500',
    });
  addressId = getBodyNumber(a, 'data', 'id');

  // Catalog
  const cat = await prisma.category.create({
    data: { name: 'Val CPUs', slug: 'val-cpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Val AMD', slug: 'val-amd', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Val CPU', slug: 'val-cpu', sku: 'VAL-CPU-001',
      description: 'Validation test', price: 5000, stock: 10, isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// --- Registration validation ---
describe('Registration validation boundaries', () => {
  it('rejects missing firstName', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      lastName: 'Doe',
      phoneNumber: '0899999999',
      email: 'nofirst@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid email format', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '0899999999',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '0899999999',
      email: 'shortpw@test.com',
      password: '1234567',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty body', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// --- Cart validation ---
describe('Cart validation boundaries', () => {
  it('rejects quantity of 0', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects negative quantity', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects quantity exceeding max (99)', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 100 });
    expect(res.status).toBe(400);
  });

  it('rejects non-integer quantity', async () => {
    const res = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 2.5 });
    expect(res.status).toBe(400);
  });
});

// --- Checkout validation ---
describe('Checkout validation boundaries', () => {
  it('rejects missing addressId', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 1, paymentMethod: 'COD' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid paymentMethod', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 1, addressId, paymentMethod: 'BITCOIN' });
    expect(res.status).toBe(400);
  });

  it('rejects missing productId in buy-now', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1, addressId, paymentMethod: 'COD' });
    expect(res.status).toBe(400);
  });
});

// --- Order list validation ---
describe('Order list validation boundaries', () => {
  it('page defaults to 1 when not provided', async () => {
    const res = await request(app)
      .get('/api/v1/account/orders')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
  });

  it('rejects page=0', async () => {
    const res = await request(app)
      .get('/api/v1/account/orders?page=0')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects negative limit', async () => {
    const res = await request(app)
      .get('/api/v1/account/orders?limit=-1')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(400);
  });
});

// --- Address validation ---
describe('Address validation boundaries', () => {
  it('rejects empty label', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        label: '',
        recipientName: 'Test',
        phoneNumber: '0899999999',
        line1: 'Street',
        district: 'D',
        subdistrict: 'S',
        province: 'P',
        postalCode: '10500',
      });
    expect(res.status).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ label: 'Home' });
    expect(res.status).toBe(400);
  });

  it('rejects short postal code', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        label: 'Home',
        recipientName: 'Test',
        phoneNumber: '0899999999',
        line1: 'Street',
        district: 'D',
        subdistrict: 'S',
        province: 'P',
        postalCode: '12',
      });
    expect(res.status).toBe(400);
  });
});

// --- Product admin validation ---
describe('Product admin validation boundaries', () => {
  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId, brandId,
        slug: 'no-name', sku: 'NN-001',
        description: 'No name', price: 100,
      });
    expect(res.status).toBe(400);
  });

  it('rejects negative price', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId, brandId,
        name: 'Neg Price', slug: 'neg-price', sku: 'NP-001',
        description: 'Test', price: -100,
      });
    expect(res.status).toBe(400);
  });

  it('rejects zero price', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId, brandId,
        name: 'Zero Price', slug: 'zero-price', sku: 'ZP-001',
        description: 'Test', price: 0,
      });
    expect(res.status).toBe(400);
  });
});

// --- Report date validation ---
describe('Report date validation boundaries', () => {
  let staffToken: string;

  beforeAll(async () => {
    // Create staff for report access
    await request(app).post('/api/v1/auth/register').send({
      firstName: 'Val',
      lastName: 'Staff',
      phoneNumber: '0811116666',
      email: 'val-staff@test.com',
      password: 'password123',
    });
    await prisma.user.update({
      where: { email: 'val-staff@test.com' },
      data: { role: 'STAFF' },
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'val-staff@test.com',
      password: 'password123',
    });
    staffToken = getBodyString(login, 'data', 'accessToken');
  });

  it('rejects invalid date format', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales?date=2026-13-45')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects non-date string', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales?date=not-a-date')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });
});
