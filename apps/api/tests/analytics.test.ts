import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getBodyArray } from './helpers.js';

const CUSTOMER = {
  firstName: 'Analytics',
  lastName: 'Customer',
  phoneNumber: '0844444444',
  email: 'analyticscustomer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Analytics',
  lastName: 'Staff',
  phoneNumber: '0855555556',
  email: 'analyticsstaff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'Analytics',
  lastName: 'Admin',
  phoneNumber: '0866666667',
  email: 'analyticsadmin@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Analytics Customer',
  phoneNumber: '0844444444',
  line1: '123 Analytics St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let staffToken: string;
let adminToken: string;
let addressId: number;
let categoryId: number;
let brandId: number;
let productId: number;
let product2Id: number;

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

async function registerAndGetToken(userData: typeof CUSTOMER): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(userData);
  return getBodyString(res, 'data', 'accessToken');
}

async function promoteAndReLogin(email: string, password: string, role: 'STAFF' | 'ADMIN'): Promise<string> {
  await prisma.user.update({
    where: { email },
    data: { role },
  });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return getBodyString(loginRes, 'data', 'accessToken');
}

beforeAll(async () => {
  await cleanDatabase();

  // Register users
  customerToken = await registerAndGetToken(CUSTOMER);
  await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');
  await registerAndGetToken(ADMIN);
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');

  // Create address
  const addrRes = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(addrRes, 'data', 'id');

  // Create catalog
  const cat = await prisma.category.create({
    data: { name: 'Storage', slug: 'storage-analytics', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Samsung', slug: 'samsung-analytics', isActive: true },
  });
  brandId = br.id;

  const p1 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: '990 PRO 2TB',
      slug: '990-pro-2tb-analytics',
      sku: 'SSD-990PRO-2TB-A',
      description: 'NVMe SSD',
      price: 8900,
      stock: 30,
      isActive: true,
    },
  });
  productId = p1.id;

  const p2 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: '980 PRO 1TB',
      slug: '980-pro-1tb-analytics',
      sku: 'SSD-980PRO-1TB-A',
      description: 'NVMe SSD',
      price: 4500,
      stock: 30,
      isActive: true,
    },
  });
  product2Id = p2.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

function cleanOrders() {
  return prisma.$transaction([
    prisma.paymentSlip.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
  ]).then(() =>
    Promise.all([
      prisma.product.update({ where: { id: productId }, data: { stock: 30 } }),
      prisma.product.update({ where: { id: product2Id }, data: { stock: 30 } }),
    ]),
  );
}

async function createAndDeliverOrder(prodId: number, qty = 1) {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId: prodId,
      quantity: qty,
      addressId,
      paymentMethod: 'COD',
    });
  const orderId = getBodyNumber(res, 'data', 'id');

  // Approve (PENDING → PROCESSING)
  await request(app)
    .post(`/api/v1/backoffice/orders/${orderId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);

  // Advance to SHIPPED
  await request(app)
    .post(`/api/v1/backoffice/orders/${orderId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'SHIPPED' });

  // Advance to DELIVERED
  await request(app)
    .post(`/api/v1/backoffice/orders/${orderId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'DELIVERED' });

  return orderId;
}

// --- Analytics ---
describe('Analytics Endpoints', () => {
  beforeEach(cleanOrders);

  it('admin can get summary', async () => {
    await createAndDeliverOrder(productId, 2);

    const res = await request(app)
      .get('/api/v1/backoffice/analytics/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.totalRevenue).toBe('number');
    expect(data.totalRevenue).toBeGreaterThan(0);
    expect(typeof data.totalOrders).toBe('number');
    expect(typeof data.pendingReviewCount).toBe('number');
    expect(Array.isArray(data.ordersByStatus)).toBe(true);
    expect(typeof data.totalCustomers).toBe('number');
    expect(typeof data.totalProducts).toBe('number');
  });

  it('staff gets 403 on summary', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/analytics/summary')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('customer gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/analytics/summary')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated gets 401', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/analytics/summary');

    expect(res.status).toBe(401);
  });

  it('revenue trend with period=7d returns array', async () => {
    await createAndDeliverOrder(productId, 2);

    const res = await request(app)
      .get('/api/v1/backoffice/analytics/revenue-trend?period=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // 7 days back + today = 8 entries
    expect(res.body.data.length).toBe(8);
    expect(res.body.data.some((point: { revenue: number; orderCount: number }) => point.revenue > 0)).toBe(true);
    for (const point of res.body.data) {
      expect(typeof point.date).toBe('string');
      expect(typeof point.revenue).toBe('number');
      expect(typeof point.orderCount).toBe('number');
    }
  });

  it('revenue trend with default period (30d) returns array', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/analytics/revenue-trend')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(31); // 30 days back + today
  });

  it('top products returns sorted results', async () => {
    // Create delivered orders: 3x product1, 1x product2
    await createAndDeliverOrder(productId, 3);
    await createAndDeliverOrder(product2Id, 1);

    const res = await request(app)
      .get('/api/v1/backoffice/analytics/top-products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    // First product should have higher totalQuantitySold
    const first = res.body.data[0];
    expect(first.productId).toBe(productId);
    expect(first.totalQuantitySold).toBe(3);
    expect(typeof first.totalRevenue).toBe('number');
    expect(typeof first.productName).toBe('string');
    expect(typeof first.sku).toBe('string');
  });

  it('top products respects limit param', async () => {
    await createAndDeliverOrder(productId, 1);
    await createAndDeliverOrder(product2Id, 1);

    const res = await request(app)
      .get('/api/v1/backoffice/analytics/top-products?limit=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
