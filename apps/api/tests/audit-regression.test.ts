import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber } from './helpers.js';

const ADMIN = {
  firstName: 'AuditReg',
  lastName: 'Admin',
  phoneNumber: '0811119999',
  email: 'auditreg-admin@test.com',
  password: 'password123',
};

const CUSTOMER = {
  firstName: 'AuditReg',
  lastName: 'Customer',
  phoneNumber: '0811110000',
  email: 'auditreg-customer@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'AuditReg Customer',
  phoneNumber: '0811110000',
  line1: '600 Audit St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let adminToken: string;
let adminUserId: number;
let customerToken: string;
let addressId: number;
let categoryId: number;
let brandId: number;
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

  // Create admin via direct DB insert (to get the user ID) + login
  const { hashPassword } = await import('../src/utils/password.js');
  const passwordHash = await hashPassword(ADMIN.password);
  const adminUser = await prisma.user.create({
    data: {
      firstName: ADMIN.firstName,
      lastName: ADMIN.lastName,
      email: ADMIN.email,
      phoneNumber: ADMIN.phoneNumber,
      passwordHash,
      role: 'ADMIN',
    },
  });
  adminUserId = adminUser.id;

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email: ADMIN.email,
    password: ADMIN.password,
  });
  adminToken = getBodyString(loginRes, 'data', 'accessToken');

  // Customer
  const r1 = await request(app).post('/api/v1/auth/register').send(CUSTOMER);
  customerToken = getBodyString(r1, 'data', 'accessToken');

  // Address for checkout
  const a = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(a, 'data', 'id');

  // Catalog
  const cat = await prisma.category.create({
    data: { name: 'Audit Reg CPUs', slug: 'audit-reg-cpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'Audit Reg AMD', slug: 'audit-reg-amd', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId, brandId,
      name: 'Audit Reg CPU', slug: 'audit-reg-cpu', sku: 'AR-CPU-001',
      description: 'Audit regression', price: 10000, stock: 50, isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
});

describe('Audit regression — product operations', () => {
  it('admin create product logs PRODUCT_CREATE', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId, brandId,
        name: 'Audit Product', slug: 'audit-product', sku: 'AP-001',
        description: 'Test', price: 5000, stock: 10,
      });

    expect(res.status).toBe(201);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'PRODUCT_CREATE' },
    });
    expect(log).not.toBeNull();
    expect(log!.actorUserId).toBe(adminUserId);
    expect(log!.entityType).toBe('Product');
    expect(log!.entityId).toBe(res.body.data.id);
  });

  it('admin delete product logs PRODUCT_DELETE', async () => {
    const createRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId, brandId,
        name: 'Delete Audit', slug: 'delete-audit', sku: 'DA-001',
        description: 'Test', price: 1000, stock: 1,
      });

    const prodId = createRes.body.data.id as number;
    await prisma.auditLog.deleteMany(); // clear create log

    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${prodId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'PRODUCT_DELETE' },
    });
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(prodId);
    expect(log!.entityType).toBe('Product');
  });
});

describe('Audit regression — order operations', () => {
  let orderId: number;

  beforeEach(async () => {
    await prisma.paymentSlip.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.update({ where: { id: productId }, data: { stock: 50 } });
    await prisma.auditLog.deleteMany();

    const res = await request(app)
      .post('/api/v1/checkout/buy-now')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 1, addressId, paymentMethod: 'COD' });
    orderId = getBodyNumber(res, 'data', 'id');
    await prisma.auditLog.deleteMany(); // clear any checkout audit
  });

  it('staff approve COD order logs ORDER_APPROVE', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_APPROVE' },
    });
    expect(log).not.toBeNull();
    expect(log!.actorUserId).toBe(adminUserId);
    expect(log!.entityType).toBe('Order');
    expect(log!.entityId).toBe(orderId);
    const metadata = log!.metadata as Record<string, unknown>;
    expect(metadata['fromStatus']).toBe('PENDING');
    expect(metadata['toStatus']).toBe('PROCESSING');
  });

  it('staff reject COD order logs ORDER_REJECT with reason', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Audit test rejection' });

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_REJECT' },
    });
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(orderId);
    const metadata = log!.metadata as Record<string, unknown>;
    expect(metadata['reason']).toBe('Audit test rejection');
  });

  it('staff advance order status logs ORDER_ADVANCE_STATUS', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });

    const res = await request(app)
      .post(`/api/v1/backoffice/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SHIPPED' });

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_ADVANCE_STATUS' },
    });
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(orderId);
    const metadata = log!.metadata as Record<string, unknown>;
    expect(metadata['fromStatus']).toBe('PROCESSING');
    expect(metadata['toStatus']).toBe('SHIPPED');
  });
});

describe('Audit regression — user management', () => {
  it('admin create privileged user logs USER_CREATE', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'NewStaff',
        lastName: 'Audit',
        email: 'newstaff-audit@test.com',
        phoneNumber: '0899990001',
        password: 'password123',
      });

    expect(res.status).toBe(201);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'USER_CREATE' },
    });
    expect(log).not.toBeNull();
    expect(log!.actorUserId).toBe(adminUserId);
    expect(log!.entityType).toBe('User');
    expect(log!.entityId).toBe(res.body.data.id);
  });

  it('admin disable user logs USER_DISABLE', async () => {
    // Create a user to disable
    const createRes = await request(app)
      .post('/api/v1/backoffice/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'ToDisable',
        lastName: 'Audit',
        email: 'todisable-audit@test.com',
        phoneNumber: '0899990002',
        password: 'password123',
      });

    const userId = createRes.body.data.id as number;
    await prisma.auditLog.deleteMany(); // clear create log

    const res = await request(app)
      .post(`/api/v1/backoffice/users/${userId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const log = await prisma.auditLog.findFirst({
      where: { action: 'USER_DISABLE' },
    });
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(userId);
    expect(log!.entityType).toBe('User');
  });
});
