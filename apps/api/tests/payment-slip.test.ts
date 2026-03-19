import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

// Mock Cloudinary before any imports that use it
vi.mock('../src/config/cloudinary.js', () => ({
  isCloudinaryConfigured: () => true,
  ensureCloudinaryConfigured: () => undefined,
  uploadImage: vi.fn().mockResolvedValue({
    imageUrl: 'https://res.cloudinary.com/test/payment-slips/mock-slip.jpg',
    imagePublicId: 'payment-slips/mock-slip',
  }),
  deleteImage: vi.fn().mockResolvedValue(undefined),
}));

const CUSTOMER_A = {
  firstName: 'Slip',
  lastName: 'Uploader',
  phoneNumber: '0811117777',
  email: 'slip-uploader@test.com',
  password: 'password123',
};

const CUSTOMER_B = {
  firstName: 'Slip',
  lastName: 'Intruder',
  phoneNumber: '0811118888',
  email: 'slip-intruder@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Slip Uploader',
  phoneNumber: '0811117777',
  line1: '500 Slip St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let tokenA: string;
let tokenB: string;
let addressAId: number;
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
  await prisma.product.update({ where: { id: productId }, data: { stock: 20 } });
}

async function createPromptPayOrder(token: string, addrId: number) {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity: 1, addressId: addrId, paymentMethod: 'PROMPTPAY_QR' });
  return getBodyNumber(res, 'data', 'id');
}

async function createCodOrder(token: string, addrId: number) {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity: 1, addressId: addrId, paymentMethod: 'COD' });
  return getBodyNumber(res, 'data', 'id');
}

// 1x1 white PNG pixel
const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

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

  const cat = await prisma.category.create({
    data: { name: 'Slip GPUs', slug: 'slip-gpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Slip NVIDIA', slug: 'slip-nvidia', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Slip GPU', slug: 'slip-gpu', sku: 'SLP-GPU-001',
      description: 'Payment slip test', price: 25000, stock: 20, isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/account/orders/:orderId/payment-slip', () => {
  beforeEach(cleanOrders);

  it('uploads slip for own PromptPay AWAITING_PAYMENT order', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('slip', FAKE_PNG, 'slip.png');

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toContain('cloudinary');

    // Verify order moved to PAYMENT_REVIEW
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PAYMENT_REVIEW');

    // Verify payment moved to PENDING_REVIEW
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    expect(payment?.status).toBe('PENDING_REVIEW');

    // Verify slip record created
    const slips = await prisma.paymentSlip.findMany({ where: { paymentId: payment!.id } });
    expect(slips).toHaveLength(1);
  });

  it('rejects slip upload for COD order', async () => {
    const orderId = await createCodOrder(tokenA, addressAId);

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('slip', FAKE_PNG, 'slip.png');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PAYMENT_METHOD');
  });

  it('rejects slip upload when order not in AWAITING_PAYMENT', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    // Move order to a different state
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PAYMENT_REVIEW' } });

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('slip', FAKE_PNG, 'slip.png');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORDER_STATUS');
  });

  it('rejects slip upload for other customer order', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenB}`)
      .attach('slip', FAKE_PNG, 'slip.png');

    expect(res.status).toBe(404);
  });

  it('rejects upload without file', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FILE');
  });

  it('rejects upload with invalid MIME type', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    const textBuffer = Buffer.from('this is not an image');
    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('slip', textBuffer, { filename: 'slip.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects unauthenticated upload', async () => {
    const orderId = await createPromptPayOrder(tokenA, addressAId);

    const res = await request(app)
      .post(`/api/v1/account/orders/${orderId}/payment-slip`)
      .attach('slip', FAKE_PNG, 'slip.png');

    expect(res.status).toBe(401);
  });
});
