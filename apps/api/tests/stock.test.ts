import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getUniqueTestPhoneNumber } from './helpers.js';

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
  await prisma.inventoryTransaction.deleteMany();
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
  await prisma.inventoryTransaction.deleteMany();
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
    phoneNumber: getUniqueTestPhoneNumber(),
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

describe('Order inventory commitment', () => {
  beforeEach(cleanOrders);

  it('does not deduct stock when buy-now order is created', async () => {
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: 3, addressId, paymentMethod: 'COD' });

    expect(res.status).toBe(201);

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(10);
  });

  it('commits stock and creates SALE transactions when COD order is approved', async () => {
    const qty = 4;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });
    const orderId = getBodyNumber(res, 'data', 'id');

    const approveRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('PROCESSING');

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(6);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: { referenceId: orderId, type: 'SALE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.productId).toBe(productAId);
    expect(transactions[0]?.quantity).toBe(qty);
    expect(transactions[0]?.referenceId).toBe(orderId);
  });

  it('does not deduct PromptPay stock until the order enters processing', async () => {
    const qty = 2;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: productAId,
        quantity: qty,
        addressId,
        paymentMethod: 'PROMPTPAY_QR',
      });
    const orderId = getBodyNumber(res, 'data', 'id');

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAYMENT_REVIEW' },
    });
    await prisma.payment.updateMany({
      where: { orderId },
      data: { status: 'PENDING_REVIEW' },
    });

    const approveRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    const stockAfterApprove = await prisma.product.findUnique({
      where: { id: productAId },
    });
    expect(stockAfterApprove?.stock).toBe(10);

    const processRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'PROCESSING' });

    expect(processRes.status).toBe(200);

    const stockAfterProcessing = await prisma.product.findUnique({
      where: { id: productAId },
    });
    expect(stockAfterProcessing?.stock).toBe(8);

    const saleCount = await prisma.inventoryTransaction.count({
      where: { referenceId: orderId, type: 'SALE' },
    });
    expect(saleCount).toBe(1);
  });

  it('rejects stock commitment when stock becomes insufficient at processing time', async () => {
    const qty = 4;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });
    const orderId = getBodyNumber(res, 'data', 'id');

    await prisma.product.update({
      where: { id: productAId },
      data: { stock: 3 },
    });

    const approveRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(approveRes.status).toBe(400);
    expect(approveRes.body.code).toBe('INSUFFICIENT_STOCK');

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PENDING');

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(3);

    const saleCount = await prisma.inventoryTransaction.count({
      where: { referenceId: orderId, type: 'SALE' },
    });
    expect(saleCount).toBe(0);
  });

  it('does not double deduct stock on repeated approval', async () => {
    const qty = 2;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });
    const orderId = getBodyNumber(res, 'data', 'id');

    const firstApproveRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(firstApproveRes.status).toBe(200);

    const secondApproveRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(secondApproveRes.status).toBe(400);
    expect(secondApproveRes.body.code).toBe('INVALID_ORDER_STATUS');

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(8);

    const saleCount = await prisma.inventoryTransaction.count({
      where: { referenceId: orderId, type: 'SALE' },
    });
    expect(saleCount).toBe(1);
  });
});

describe('Order inventory restoration', () => {
  beforeEach(cleanOrders);

  it('restores stock and creates RETURN_IN transactions when a committed order is cancelled', async () => {
    const qty = 3;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });
    const orderId = getBodyNumber(res, 'data', 'id');

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    const cancelRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Stock restoration test' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(10);

    const returnTransactions = await prisma.inventoryTransaction.findMany({
      where: { referenceId: orderId, type: 'RETURN_IN' },
      orderBy: { createdAt: 'asc' },
    });
    expect(returnTransactions).toHaveLength(1);
    expect(returnTransactions[0]?.productId).toBe(productAId);
    expect(returnTransactions[0]?.quantity).toBe(qty);
  });

  it('does not double restore stock on repeated cancellation', async () => {
    const qty = 2;
    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: productAId, quantity: qty, addressId, paymentMethod: 'COD' });
    const orderId = getBodyNumber(res, 'data', 'id');

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    const firstCancelRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'First cancellation' });
    expect(firstCancelRes.status).toBe(200);

    const secondCancelRes = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Second cancellation' });
    expect(secondCancelRes.status).toBe(400);
    expect(secondCancelRes.body.code).toBe('INVALID_ORDER_STATUS');

    const product = await prisma.product.findUnique({ where: { id: productAId } });
    expect(product?.stock).toBe(10);

    const returnCount = await prisma.inventoryTransaction.count({
      where: { referenceId: orderId, type: 'RETURN_IN' },
    });
    expect(returnCount).toBe(1);
  });

  it('commits and restores inventory for all items in a cart order', async () => {
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
    const orderId = getBodyNumber(checkoutRes, 'data', 'id');

    const stockAAfterCheckout = await prisma.product.findUnique({
      where: { id: productAId },
    });
    const stockBAfterCheckout = await prisma.product.findUnique({
      where: { id: productBId },
    });
    expect(stockAAfterCheckout?.stock).toBe(10);
    expect(stockBAfterCheckout?.stock).toBe(5);

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${staffToken}`);

    const stockAAfterApprove = await prisma.product.findUnique({
      where: { id: productAId },
    });
    const stockBAfterApprove = await prisma.product.findUnique({
      where: { id: productBId },
    });
    expect(stockAAfterApprove?.stock).toBe(8);
    expect(stockBAfterApprove?.stock).toBe(2);

    const saleTransactions = await prisma.inventoryTransaction.findMany({
      where: { referenceId: orderId, type: 'SALE' },
      orderBy: { productId: 'asc' },
    });
    expect(saleTransactions).toHaveLength(2);
    expect(saleTransactions.every((row) => row.referenceId === orderId)).toBe(true);

    await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Cancel multi-item order' });

    const stockAAfterCancel = await prisma.product.findUnique({
      where: { id: productAId },
    });
    const stockBAfterCancel = await prisma.product.findUnique({
      where: { id: productBId },
    });
    expect(stockAAfterCancel?.stock).toBe(10);
    expect(stockBAfterCancel?.stock).toBe(5);

    const returnCount = await prisma.inventoryTransaction.count({
      where: { referenceId: orderId, type: 'RETURN_IN' },
    });
    expect(returnCount).toBe(2);
  });
});
