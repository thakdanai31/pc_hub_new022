import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

const CUSTOMER = {
  firstName: 'Trans',
  lastName: 'Customer',
  phoneNumber: '0811112222',
  email: 'trans-customer@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Trans Customer',
  phoneNumber: '0811112222',
  line1: '200 Transition St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let staffToken: string;
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

async function cleanOrders() {
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.update({ where: { id: productId }, data: { stock: 50 } });
}

async function createCodOrder() {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ productId, quantity: 1, addressId, paymentMethod: 'COD' });
  return getBodyNumber(res, 'data', 'id');
}

async function createPromptPayOrder() {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ productId, quantity: 1, addressId, paymentMethod: 'PROMPTPAY_QR' });
  return getBodyNumber(res, 'data', 'id');
}

async function setOrderStatus(orderId: number, status: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: status as never },
  });
}

beforeAll(async () => {
  await cleanDatabase();

  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  customerToken = getBodyString(r1, 'data', 'accessToken');

  // Create staff via register + role update + re-login
  await request(app).post('/api/v1/auth/register').send({
    ...CUSTOMER,
    email: 'trans-staff@test.com',
  });
  await prisma.user.update({
    where: { email: 'trans-staff@test.com' },
    data: { role: 'STAFF' },
  });
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: 'trans-staff@test.com',
    password: 'password123',
  });
  staffToken = getBodyString(loginRes, 'data', 'accessToken');

  const a = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a, 'data', 'id');

  const cat = await prisma.category.create({
    data: { name: 'Trans CPUs', slug: 'trans-cpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Trans AMD', slug: 'trans-amd', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Ryzen Trans', slug: 'ryzen-trans', sku: 'TRANS-CPU-001',
      description: 'Transition test', price: 10000, stock: 50, isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// --- COD approve invalid states ---
describe('COD order — approve from invalid states', () => {
  const invalidStates = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'];

  beforeEach(cleanOrders);

  for (const status of invalidStates) {
    it(`cannot approve COD order in ${status}`, async () => {
      const orderId = await createCodOrder();
      await setOrderStatus(orderId, status);

      const res = await request(app)
        .post(`/api/v1/backoffice/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ORDER_STATUS');
    });
  }
});

// --- COD reject invalid states ---
describe('COD order — reject from invalid states', () => {
  const invalidStates = ['PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'];

  beforeEach(cleanOrders);

  for (const status of invalidStates) {
    it(`cannot reject COD order in ${status}`, async () => {
      const orderId = await createCodOrder();
      await setOrderStatus(orderId, status);

      const res = await request(app)
        .post(`/api/v1/backoffice/orders/${orderId}/reject`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Test rejection' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ORDER_STATUS');
    });
  }
});

// --- PromptPay approve invalid states ---
describe('PromptPay order — approve from invalid states', () => {
  const invalidStates = ['AWAITING_PAYMENT', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'];

  beforeEach(cleanOrders);

  for (const status of invalidStates) {
    it(`cannot approve PromptPay order in ${status}`, async () => {
      const orderId = await createPromptPayOrder();
      await setOrderStatus(orderId, status);

      const res = await request(app)
        .post(`/api/v1/backoffice/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ORDER_STATUS');
    });
  }
});

// --- PromptPay reject invalid states ---
describe('PromptPay order — reject from invalid states', () => {
  const invalidStates = ['AWAITING_PAYMENT', 'APPROVED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'];

  beforeEach(cleanOrders);

  for (const status of invalidStates) {
    it(`cannot reject PromptPay order in ${status}`, async () => {
      const orderId = await createPromptPayOrder();
      await setOrderStatus(orderId, status);

      const res = await request(app)
        .post(`/api/v1/backoffice/orders/${orderId}/reject`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Test rejection' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ORDER_STATUS');
    });
  }
});

// --- advanceOrderStatus invalid transitions ---
describe('Order status advancement — invalid transitions', () => {
  beforeEach(cleanOrders);

  it('cannot advance PENDING directly to SHIPPED', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot advance PENDING directly to DELIVERED', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'DELIVERED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot advance from DELIVERED', async () => {
    const orderId = await createCodOrder();
    await setOrderStatus(orderId, 'DELIVERED');

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot advance from REJECTED', async () => {
    const orderId = await createCodOrder();
    await setOrderStatus(orderId, 'REJECTED');

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'PROCESSING' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot advance from CANCELLED', async () => {
    const orderId = await createCodOrder();
    await setOrderStatus(orderId, 'CANCELLED');

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'PROCESSING' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cannot use advance endpoint for APPROVED transition', async () => {
    const orderId = await createCodOrder();
    await setOrderStatus(orderId, 'PAYMENT_REVIEW');

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('cannot use advance endpoint for REJECTED transition', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'REJECTED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// --- Enum validation rejection ---
describe('Order status advancement — schema validation', () => {
  beforeEach(cleanOrders);

  it('rejects arbitrary string as status', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'FOOBAR' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty status', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects APPROVED through advance endpoint at schema level', async () => {
    const orderId = await createCodOrder();

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// --- Backoffice order list query enum validation ---
describe('Backoffice order list — query enum validation', () => {
  it('rejects invalid status filter', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/orders?status=INVALID_STATUS')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid paymentMethod filter', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/orders?paymentMethod=BITCOIN')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('accepts valid status filter', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/orders?status=PENDING')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
  });

  it('accepts valid paymentMethod filter', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/orders?paymentMethod=COD')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
  });
});
