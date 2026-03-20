import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyArray, getBodyNumber, getBodyString } from './helpers.js';

const CUSTOMER_A = {
  firstName: 'Claim',
  lastName: 'Owner',
  phoneNumber: '0812001000',
  email: 'claim-owner@test.com',
  password: 'password123',
};

const CUSTOMER_B = {
  firstName: 'Claim',
  lastName: 'Other',
  phoneNumber: '0822002000',
  email: 'claim-other@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Claim',
  lastName: 'Staff',
  phoneNumber: '0832003000',
  email: 'claim-staff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'Claim',
  lastName: 'Admin',
  phoneNumber: '0842004000',
  email: 'claim-admin@test.com',
  password: 'password123',
};

const BASE_ADDRESS = {
  label: 'Home',
  recipientName: 'Claim User',
  phoneNumber: '0812001000',
  line1: '100 Claim St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerTokenA: string;
let customerTokenB: string;
let staffToken: string;
let adminToken: string;
let addressAId: number;
let addressBId: number;
let productId: number;
let product2Id: number;
let categoryId: number;
let brandId: number;

async function cleanDatabase() {
  await prisma.claim.deleteMany();
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

async function registerAndGetToken(userData: typeof CUSTOMER_A) {
  const res = await request(app).post('/api/v1/auth/register').send(userData);

  return {
    token: getBodyString(res, 'data', 'accessToken'),
    userId: getBodyNumber(res, 'data', 'user', 'id'),
  };
}

async function promoteAndReLogin(
  email: string,
  password: string,
  role: 'STAFF' | 'ADMIN',
) {
  await prisma.user.update({
    where: { email },
    data: { role },
  });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return getBodyString(res, 'data', 'accessToken');
}

async function createDeliveredOrder(
  token: string,
  addressId: number,
  orderProductId: number = productId,
) {
  const checkoutRes = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId: orderProductId,
      quantity: 1,
      addressId,
      paymentMethod: 'COD',
    });

  const orderId = getBodyNumber(checkoutRes, 'data', 'id');
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'DELIVERED' },
  });

  return orderId;
}

async function createPendingOrder(
  token: string,
  addressId: number,
  orderProductId: number = productId,
) {
  const checkoutRes = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId: orderProductId,
      quantity: 1,
      addressId,
      paymentMethod: 'COD',
    });

  return getBodyNumber(checkoutRes, 'data', 'id');
}

beforeAll(async () => {
  await cleanDatabase();

  const customerA = await registerAndGetToken(CUSTOMER_A);
  customerTokenA = customerA.token;

  const customerB = await registerAndGetToken(CUSTOMER_B);
  customerTokenB = customerB.token;

  const staff = await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');

  const admin = await registerAndGetToken(ADMIN);
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');

  const addressA = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerTokenA}`)
    .send(BASE_ADDRESS);
  addressAId = getBodyNumber(addressA, 'data', 'id');

  const addressB = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerTokenB}`)
    .send({
      ...BASE_ADDRESS,
      recipientName: 'Claim Other',
      phoneNumber: '0822002000',
    });
  addressBId = getBodyNumber(addressB, 'data', 'id');

  const category = await prisma.category.create({
    data: {
      name: 'Claim GPUs',
      slug: 'claim-gpus',
      isActive: true,
    },
  });
  categoryId = category.id;

  const brand = await prisma.brand.create({
    data: {
      name: 'NVIDIA',
      slug: 'nvidia-claim',
      isActive: true,
    },
  });
  brandId = brand.id;

  const product = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'NVIDIA GeForce RTX 4070',
      slug: 'nvidia-geforce-rtx-4070-claim',
      sku: 'GPU-NVIDIA-RTX4070-CLAIM',
      description: 'Claim test GPU',
      price: 22900,
      stock: 20,
      isActive: true,
    },
  });
  productId = product.id;

  const product2 = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'NVIDIA GeForce RTX 4060 Ti',
      slug: 'nvidia-geforce-rtx-4060-ti-claim',
      sku: 'GPU-NVIDIA-RTX4060TI-CLAIM',
      description: 'Secondary claim test GPU',
      price: 16900,
      stock: 20,
      isActive: true,
    },
  });
  product2Id = product2.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.claim.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.update({
    where: { id: productId },
    data: { stock: 20 },
  });
  await prisma.product.update({
    where: { id: product2Id },
    data: { stock: 20 },
  });
});

describe('Claim management', () => {
  it('customer can create a claim for a delivered purchased product', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);

    const res = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Intermittent display artifacts after a few minutes.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.orderId).toBe(orderId);
    expect(res.body.data.productId).toBe(productId);
  });

  it('rejects claim creation for non-delivered orders', async () => {
    const orderId = await createPendingOrder(customerTokenA, addressAId);

    const res = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Trying to claim too early.',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORDER_STATUS');
  });

  it('rejects claim creation for another user order', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);

    const res = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenB}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Unauthorized claim attempt.',
      });

    expect(res.status).toBe(404);
  });

  it('rejects invalid order-product pairing', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId, productId);

    const res = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId: product2Id,
        issueDescription: 'Product not actually purchased in this order.',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ORDER_PRODUCT');
  });

  it('rejects duplicate active claims for the same user order and product', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);

    const firstRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'First claim submission.',
      });
    expect(firstRes.status).toBe(201);

    const duplicateRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Duplicate active claim submission.',
      });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.code).toBe('ACTIVE_CLAIM_EXISTS');
  });

  it('allows a new claim after the previous claim reached a terminal status', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);

    const firstRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Initial claim before rejection.',
      });
    const firstClaimId = getBodyNumber(firstRes, 'data', 'id');

    const rejectRes = await request(app)
      .patch(`/api/v1/backoffice/claims/${firstClaimId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'REJECTED' });
    expect(rejectRes.status).toBe(200);

    const secondRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'New claim after terminal decision.',
      });

    expect(secondRes.status).toBe(201);

    const claimCount = await prisma.claim.count({
      where: {
        userId: getBodyNumber(firstRes, 'data', 'userId'),
        orderId,
        productId,
      },
    });
    expect(claimCount).toBe(2);
  });

  it('customer can list only their own claims', async () => {
    const orderAId = await createDeliveredOrder(customerTokenA, addressAId);
    await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId: orderAId,
        productId,
        issueDescription: 'Customer A claim',
      });

    const orderBId = await createDeliveredOrder(customerTokenB, addressBId);
    await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenB}`)
      .send({
        orderId: orderBId,
        productId,
        issueDescription: 'Customer B claim',
      });

    const res = await request(app)
      .get('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`);

    expect(res.status).toBe(200);
    const data = getBodyArray(res, 'data');
    expect(data).toHaveLength(1);
    const row = data[0] as Record<string, unknown>;
    expect(row['userId']).toBeDefined();
    expect(row['orderId']).toBe(orderAId);
  });

  it('customer can view own claim but not another user claim', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);
    const createRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Own claim detail check',
      });
    const claimId = getBodyNumber(createRes, 'data', 'id');

    const ownRes = await request(app)
      .get(`/api/v1/account/claims/${claimId}`)
      .set('Authorization', `Bearer ${customerTokenA}`);
    expect(ownRes.status).toBe(200);

    const otherRes = await request(app)
      .get(`/api/v1/account/claims/${claimId}`)
      .set('Authorization', `Bearer ${customerTokenB}`);
    expect(otherRes.status).toBe(404);
  });

  it('staff can list all claims and update claim status', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);
    const createRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Needs staff review',
      });
    const claimId = getBodyNumber(createRes, 'data', 'id');

    const listRes = await request(app)
      .get('/api/v1/backoffice/claims')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(listRes.status).toBe(200);
    const claims = getBodyArray(listRes, 'data');
    expect(claims).toHaveLength(1);

    const updateRes = await request(app)
      .patch(`/api/v1/backoffice/claims/${claimId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'IN_REVIEW' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('IN_REVIEW');
  });

  it('rejects invalid claim status transitions', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);
    const createRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Attempt invalid transition.',
      });
    const claimId = getBodyNumber(createRes, 'data', 'id');

    const updateRes = await request(app)
      .patch(`/api/v1/backoffice/claims/${claimId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'COMPLETED' });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('rejects no-op claim status updates', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);
    const createRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Attempt no-op transition.',
      });
    const claimId = getBodyNumber(createRes, 'data', 'id');

    const updateRes = await request(app)
      .patch(`/api/v1/backoffice/claims/${claimId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'PENDING' });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.code).toBe('NO_OP_STATUS_UPDATE');
  });

  it('admin can update claim admin note', async () => {
    const orderId = await createDeliveredOrder(customerTokenA, addressAId);
    const createRes = await request(app)
      .post('/api/v1/account/claims')
      .set('Authorization', `Bearer ${customerTokenA}`)
      .send({
        orderId,
        productId,
        issueDescription: 'Admin note update check',
      });
    const claimId = getBodyNumber(createRes, 'data', 'id');

    const res = await request(app)
      .patch(`/api/v1/backoffice/claims/${claimId}/admin-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ adminNote: 'Awaiting RMA approval from supplier.' });

    expect(res.status).toBe(200);
    expect(res.body.data.adminNote).toBe('Awaiting RMA approval from supplier.');
  });

  it('customer cannot access backoffice claim routes', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/claims')
      .set('Authorization', `Bearer ${customerTokenA}`);

    expect(res.status).toBe(403);
  });
});
