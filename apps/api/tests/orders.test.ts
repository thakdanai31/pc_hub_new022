import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

const CUSTOMER = {
  firstName: 'Order',
  lastName: 'Customer',
  phoneNumber: '0855555555',
  email: 'ordercustomer@test.com',
  password: 'password123',
};

const CUSTOMER_2 = {
  firstName: 'Other',
  lastName: 'OrderCustomer',
  phoneNumber: '0866666666',
  email: 'otherordercustomer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Staff',
  lastName: 'Reviewer',
  phoneNumber: '0877777777',
  email: 'staffreviewer@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Order Customer',
  phoneNumber: '0855555555',
  line1: '456 Order St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let customer2Token: string;
let staffToken: string;
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

async function createCodOrder(token: string, addrId: number, prodId: number, qty = 1) {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: prodId, quantity: qty, addressId: addrId, paymentMethod: 'COD' });
  return {
    orderId: getBodyNumber(res, 'data', 'id'),
    orderNumber: getBodyString(res, 'data', 'orderNumber'),
  };
}

async function createPromptPayOrder(token: string, addrId: number, prodId: number, qty = 1) {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: prodId, quantity: qty, addressId: addrId, paymentMethod: 'PROMPTPAY_QR' });
  return {
    orderId: getBodyNumber(res, 'data', 'id'),
    orderNumber: getBodyString(res, 'data', 'orderNumber'),
  };
}

beforeAll(async () => {
  await cleanDatabase();

  // Register customers
  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  customerToken = getBodyString(r1, 'data', 'accessToken');

  const r2 = await request(app).post('/api/v1/auth/register').send(CUSTOMER_2);
  customer2Token = getBodyString(r2, 'data', 'accessToken');

  // Create staff user directly in DB
  const staffUser = await prisma.user.create({
    data: {
      firstName: STAFF.firstName,
      lastName: STAFF.lastName,
      phoneNumber: STAFF.phoneNumber,
      email: STAFF.email,
      passwordHash: '$2b$10$dummyhash',
      role: 'STAFF',
    },
  });

  // Login staff — we need a token, so register then update role
  const sr = await request(app).post('/api/v1/auth/register').send({
    ...STAFF,
    email: 'stafflogin@test.com',
  });
  staffToken = getBodyString(sr, 'data', 'accessToken');
  // Update role to STAFF
  const userId = getBodyNumber(sr, 'data', 'user', 'id');
  await prisma.user.update({ where: { id: userId }, data: { role: 'STAFF' } });
  // Re-login to get token with STAFF role
  // Actually, the JWT already has the role baked in. Let's just issue a fresh token.
  // We need to login again with updated role. But since we can't change the token mid-test,
  // let's use a workaround: directly create the token.
  // Actually, let's just delete the staff user created directly and re-register + update:
  await prisma.refreshToken.deleteMany({ where: { userId: staffUser.id } });
  await prisma.user.delete({ where: { id: staffUser.id } });

  // The stafflogin user is registered as CUSTOMER, we updated to STAFF.
  // But the JWT was created with CUSTOMER role. We need a new token.
  // Let's re-login:
  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: 'stafflogin@test.com',
    password: 'password123',
  });
  staffToken = getBodyString(loginRes, 'data', 'accessToken');

  // Create addresses
  const a1 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a1, 'data', 'id');

  const a2 = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customer2Token}`)
    .send({ ...TEST_ADDRESS, recipientName: 'Other Customer' });
  address2Id = getBodyNumber(a2, 'data', 'id');

  // Create catalog
  const cat = await prisma.category.create({
    data: { name: 'Processors', slug: 'processors', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'AMD', slug: 'amd', isActive: true },
  });
  brandId = br.id;

  const p1 = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Ryzen 9 7950X', slug: 'ryzen-9-7950x', sku: 'CPU-R9-7950X',
      description: 'High-end CPU', price: 21900, stock: 10, isActive: true,
    },
  });
  productId = p1.id;

  const p2 = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Ryzen 7 7700X', slug: 'ryzen-7-7700x', sku: 'CPU-R7-7700X',
      description: 'Mid-range CPU', price: 12900, stock: 8, isActive: true,
    },
  });
  product2Id = p2.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

function resetStock() {
  return Promise.all([
    prisma.product.update({ where: { id: productId }, data: { stock: 10, isActive: true } }),
    prisma.product.update({ where: { id: product2Id }, data: { stock: 8, isActive: true } }),
  ]);
}

async function cleanOrders() {
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await resetStock();
}

// --- Payment creation at checkout ---
describe('Payment creation at checkout', () => {
  beforeEach(cleanOrders);

  it('COD checkout creates Payment with UNPAID status', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('UNPAID');
    expect(payment?.paymentMethod).toBe('COD');
  });

  it('PromptPay checkout creates Payment with UNPAID status', async () => {
    const { orderId } = await createPromptPayOrder(customerToken, addressId, productId);
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe('UNPAID');
    expect(payment?.paymentMethod).toBe('PROMPTPAY_QR');
  });

  it('Payment amount matches order totalAmount', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId, 2);
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(Number(payment?.amount)).toBe(Number(order?.totalAmount));
  });
});

// --- Customer order history ---
describe('GET /api/v1/account/orders', () => {
  beforeEach(cleanOrders);

  it('returns paginated list of own orders', async () => {
    await createCodOrder(customerToken, addressId, productId);
    await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get('/api/v1/account/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('filters by status', async () => {
    await createCodOrder(customerToken, addressId, productId);
    await createPromptPayOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get('/api/v1/account/orders?status=PENDING')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('PENDING');
  });

  it('does not show other customer orders', async () => {
    await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get('/api/v1/account/orders')
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 401 for unauthenticated', async () => {
    const res = await request(app).get('/api/v1/account/orders');
    expect(res.status).toBe(401);
  });
});

// --- Customer order detail ---
describe('GET /api/v1/account/orders/:orderId', () => {
  beforeEach(cleanOrders);

  it('returns full order detail with items and payment', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId, 2);

    const res = await request(app)
      .get(`/api/v1/account/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toMatch(/^PCH-/);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.payment).not.toBeNull();
    expect(res.body.data.payment.status).toBe('UNPAID');
    expect(res.body.data.addressSnapshot).toBeDefined();
  });

  it('returns 404 for other customer order', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get(`/api/v1/account/orders/${orderId}`)
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .get('/api/v1/account/orders/999999')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
  });
});

// --- Backoffice order listing ---
describe('GET /api/v1/backoffice/orders', () => {
  beforeEach(cleanOrders);

  it('staff can list all orders', async () => {
    await createCodOrder(customerToken, addressId, productId);
    await createPromptPayOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get('/api/v1/backoffice/orders')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].customer).toBeDefined();
  });

  it('customer cannot access backoffice orders', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/orders')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

// --- Backoffice order detail ---
describe('GET /api/v1/backoffice/orders/:orderId', () => {
  beforeEach(cleanOrders);

  it('staff can view full order detail', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get(`/api/v1/backoffice/orders/${orderId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.customer).toBeDefined();
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.payment).not.toBeNull();
  });
});

// --- Approval ---
describe('POST /api/v1/backoffice/orders/:orderId/approve', () => {
  beforeEach(cleanOrders);

  it('approves COD order PENDING -> PROCESSING', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PROCESSING');

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PROCESSING');
    expect(order?.approvedByUserId).not.toBeNull();
    expect(order?.approvedAt).not.toBeNull();
  });

  it('approves PromptPay order in PAYMENT_REVIEW -> APPROVED', async () => {
    const { orderId } = await createPromptPayOrder(customerToken, addressId, productId);

    // Move to PAYMENT_REVIEW
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' } });
    await prisma.payment.updateMany({ where: { orderId }, data: { status: 'PENDING_REVIEW' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment?.status).toBe('APPROVED');
    expect(payment?.reviewedByUserId).not.toBeNull();
  });

  it('cannot approve already-approved order', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORDER_STATUS');
  });

  it('customer cannot approve', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });
});

// --- Rejection ---
describe('POST /api/v1/backoffice/orders/:orderId/reject', () => {
  beforeEach(cleanOrders);

  it('rejects COD order and restores stock', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId, 3);

    const stockBefore = (await prisma.product.findUnique({ where: { id: productId } }))?.stock;

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Customer requested cancellation' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('REJECTED');
    expect(order?.rejectReason).toBe('Customer requested cancellation');
    expect(order?.rejectedByUserId).not.toBeNull();

    const stockAfter = (await prisma.product.findUnique({ where: { id: productId } }))?.stock;
    expect(stockAfter).toBe((stockBefore ?? 0) + 3);
  });

  it('rejects PromptPay order in PAYMENT_REVIEW and restores stock', async () => {
    const { orderId } = await createPromptPayOrder(customerToken, addressId, productId, 2);

    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' } });
    await prisma.payment.updateMany({ where: { orderId }, data: { status: 'PENDING_REVIEW' } });

    const stockBefore = (await prisma.product.findUnique({ where: { id: productId } }))?.stock;

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Invalid payment slip' });

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment?.status).toBe('REJECTED');
    expect(payment?.rejectReason).toBe('Invalid payment slip');

    const stockAfter = (await prisma.product.findUnique({ where: { id: productId } }))?.stock;
    expect(stockAfter).toBe((stockBefore ?? 0) + 2);
  });

  it('cannot reject terminal-status order', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Test' });

    expect(res.status).toBe(400);
  });

  it('missing reason returns 400', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// --- Status advancement ---
describe('POST /api/v1/backoffice/orders/:orderId/status', () => {
  beforeEach(cleanOrders);

  it('advances PROCESSING -> SHIPPED', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SHIPPED');
  });

  it('advances SHIPPED -> DELIVERED', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);
    await prisma.order.update({ where: { id: orderId }, data: { status: 'SHIPPED' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'DELIVERED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DELIVERED');
  });

  it('rejects invalid transition', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'DELIVERED' });

    // PENDING -> DELIVERED is not allowed
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('customer cannot advance status', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'PROCESSING' });

    expect(res.status).toBe(403);
  });
});

// --- Customer payment detail ---
describe('GET /api/v1/account/orders/:orderId/payment', () => {
  beforeEach(cleanOrders);

  it('returns payment info for own order', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get(`/api/v1/account/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNPAID');
    expect(res.body.data.paymentMethod).toBe('COD');
  });

  it('returns 404 for other customer', async () => {
    const { orderId } = await createCodOrder(customerToken, addressId, productId);

    const res = await request(app)
      .get(`/api/v1/account/orders/${orderId}/payment`)
      .set('Authorization', `Bearer ${customer2Token}`);

    expect(res.status).toBe(404);
  });
});
