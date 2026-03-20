import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyArray, getBodyNumber, getBodyString } from './helpers.js';

const CUSTOMER = {
  firstName: 'Reconcile',
  lastName: 'Customer',
  phoneNumber: '0840004000',
  email: 'inventory-reconcile-customer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Reconcile',
  lastName: 'Staff',
  phoneNumber: '0850005000',
  email: 'inventory-reconcile-staff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'Reconcile',
  lastName: 'Admin',
  phoneNumber: '0860006000',
  email: 'inventory-reconcile-admin@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Warehouse',
  recipientName: 'Reconcile Customer',
  phoneNumber: '0840004000',
  line1: '400 Inventory Ops Rd',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let staffToken: string;
let adminToken: string;
let addressId: number;
let productId: number;
let categoryId: number;
let brandId: number;

async function clearClaimsIfTableExists() {
  try {
    await prisma.claim.deleteMany();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2021'
    ) {
      return;
    }

    throw error;
  }
}

async function cleanDatabase() {
  await clearClaimsIfTableExists();
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

async function cleanOperationalData() {
  await clearClaimsIfTableExists();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.update({
    where: { id: productId },
    data: { stock: 10 },
  });
}

async function registerAndGetToken(userData: typeof CUSTOMER) {
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

async function createCodOrder(quantity: number): Promise<number> {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId,
      quantity,
      addressId,
      paymentMethod: 'COD',
    });

  expect(res.status).toBe(201);
  return getBodyNumber(res, 'data', 'id');
}

async function approveOrder(orderId: number): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/backoffice/orders/${orderId}/approve`)
    .set('Authorization', `Bearer ${staffToken}`);

  expect(res.status).toBe(200);
}

async function cancelOrder(orderId: number): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/backoffice/orders/${orderId}/cancel`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ reason: 'Inventory reconciliation test cancellation' });

  expect(res.status).toBe(200);
}

beforeAll(async () => {
  await cleanDatabase();

  const customer = await registerAndGetToken(CUSTOMER);
  customerToken = customer.token;

  await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');

  await registerAndGetToken(ADMIN);
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');

  const addressRes = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(addressRes, 'data', 'id');

  const category = await prisma.category.create({
    data: {
      name: 'Inventory Reconciliation',
      slug: 'inventory-reconciliation',
      isActive: true,
    },
  });
  categoryId = category.id;

  const brand = await prisma.brand.create({
    data: {
      name: 'Reconciliation Brand',
      slug: 'reconciliation-brand',
      isActive: true,
    },
  });
  brandId = brand.id;

  const product = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'Reconciliation Test Product',
      slug: 'reconciliation-test-product',
      sku: 'RECON-001',
      description: 'Inventory reconciliation test product',
      price: 8990,
      stock: 10,
      isActive: true,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanOperationalData();
});

describe('Inventory reconciliation report', () => {
  it('detects missing sale history and keeps dry run side-effect free', async () => {
    const orderId = await createCodOrder(3);
    await approveOrder(orderId);

    await prisma.inventoryTransaction.deleteMany({
      where: {
        referenceId: orderId,
        type: 'SALE',
      },
    });

    const stockBeforeDryRun = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(stockBeforeDryRun?.stock).toBe(7);

    const reportRes = await request(app)
      .get('/api/v1/backoffice/inventory/reconciliation')
      .query({ orderId })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const rows = getBodyArray(reportRes, 'data', 'rows');
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    expect(row['orderId']).toBe(orderId);
    expect(row['autoFixable']).toBe(true);

    const issues = row['issues'] as Array<Record<string, unknown>>;
    expect(issues.some((issue) => issue['code'] === 'MISSING_SALE_HISTORY')).toBe(
      true,
    );

    const suggestedActions = row['suggestedActions'] as string[];
    expect(suggestedActions).toContain('BACKFILL_SALE_HISTORY');

    const dryRunRes = await request(app)
      .post('/api/v1/backoffice/inventory/reconciliation/backfill')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderIds: [orderId] });

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.data.dryRun).toBe(true);

    const results = getBodyArray(dryRunRes, 'data', 'results');
    const result = results[0] as Record<string, unknown>;
    expect(result['status']).toBe('planned');

    const saleCount = await prisma.inventoryTransaction.count({
      where: {
        referenceId: orderId,
        type: 'SALE',
      },
    });
    expect(saleCount).toBe(0);

    const stockAfterDryRun = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(stockAfterDryRun?.stock).toBe(7);

    const dryRunAuditCount = await prisma.auditLog.count({
      where: { action: 'INVENTORY_RECONCILIATION_DRY_RUN' },
    });
    expect(dryRunAuditCount).toBe(1);
  });

  it('marks duplicate sale history for manual review and does not auto-fix it', async () => {
    const orderId = await createCodOrder(2);
    await approveOrder(orderId);

    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: 'SALE',
        quantity: 2,
        referenceId: orderId,
        note: 'Legacy duplicate sale row',
      },
    });

    const reportRes = await request(app)
      .get('/api/v1/backoffice/inventory/reconciliation')
      .query({ orderId })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    const rows = getBodyArray(reportRes, 'data', 'rows');
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    expect(row['autoFixable']).toBe(false);
    expect(row['manualReviewRequired']).toBe(true);

    const issues = row['issues'] as Array<Record<string, unknown>>;
    expect(
      issues.some((issue) => issue['code'] === 'DUPLICATE_SALE_HISTORY'),
    ).toBe(true);

    const applyRes = await request(app)
      .post('/api/v1/backoffice/inventory/reconciliation/backfill')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderIds: [orderId], dryRun: false });

    expect(applyRes.status).toBe(200);
    const results = getBodyArray(applyRes, 'data', 'results');
    const result = results[0] as Record<string, unknown>;
    expect(result['status']).toBe('skipped');

    const saleCount = await prisma.inventoryTransaction.count({
      where: {
        referenceId: orderId,
        type: 'SALE',
      },
    });
    expect(saleCount).toBe(2);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(product?.stock).toBe(8);
  });
});

describe('Inventory reconciliation backfill', () => {
  it('backfills missing sale history without changing stock and writes audit logs', async () => {
    const orderId = await createCodOrder(3);
    await approveOrder(orderId);

    await prisma.inventoryTransaction.deleteMany({
      where: {
        referenceId: orderId,
        type: 'SALE',
      },
    });

    const applyRes = await request(app)
      .post('/api/v1/backoffice/inventory/reconciliation/backfill')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderIds: [orderId], dryRun: false });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.data.dryRun).toBe(false);

    const results = getBodyArray(applyRes, 'data', 'results');
    const result = results[0] as Record<string, unknown>;
    expect(result['status']).toBe('applied');

    const appliedActions = result['appliedActions'] as string[];
    expect(appliedActions).toContain('BACKFILL_SALE_HISTORY');

    const saleTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        referenceId: orderId,
        type: 'SALE',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(saleTransactions).toHaveLength(1);
    expect(saleTransactions[0]?.quantity).toBe(3);
    expect(saleTransactions[0]?.note).toContain('Reconciliation backfill');

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(product?.stock).toBe(7);

    const backfillAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'INVENTORY_SALE_HISTORY_BACKFILL',
        entityType: 'Order',
        entityId: orderId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(backfillAudit).toBeTruthy();
    expect(backfillAudit?.metadata).toMatchObject({
      historyOnly: true,
      stockMutationApplied: false,
    });

    const applyAuditCount = await prisma.auditLog.count({
      where: { action: 'INVENTORY_RECONCILIATION_APPLY' },
    });
    expect(applyAuditCount).toBe(1);
  });

  it('backfills missing return history without changing stock', async () => {
    const orderId = await createCodOrder(2);
    await approveOrder(orderId);
    await cancelOrder(orderId);

    await prisma.inventoryTransaction.deleteMany({
      where: {
        referenceId: orderId,
        type: 'RETURN_IN',
      },
    });

    const stockBeforeBackfill = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(stockBeforeBackfill?.stock).toBe(10);

    const applyRes = await request(app)
      .post('/api/v1/backoffice/inventory/reconciliation/backfill')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderIds: [orderId], dryRun: false });

    expect(applyRes.status).toBe(200);

    const results = getBodyArray(applyRes, 'data', 'results');
    const result = results[0] as Record<string, unknown>;
    expect(result['status']).toBe('applied');

    const appliedActions = result['appliedActions'] as string[];
    expect(appliedActions).toContain('BACKFILL_RETURN_HISTORY');

    const returnTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        referenceId: orderId,
        type: 'RETURN_IN',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(returnTransactions).toHaveLength(1);
    expect(returnTransactions[0]?.quantity).toBe(2);
    expect(returnTransactions[0]?.note).toContain('Reconciliation backfill');

    const stockAfterBackfill = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true },
    });
    expect(stockAfterBackfill?.stock).toBe(10);
  });
});

describe('Inventory reconciliation authorization', () => {
  it('restricts reconciliation report and backfill to admin users', async () => {
    const reportRes = await request(app)
      .get('/api/v1/backoffice/inventory/reconciliation')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(reportRes.status).toBe(403);
    expect(reportRes.body.code).toBe('FORBIDDEN');

    const backfillRes = await request(app)
      .post('/api/v1/backoffice/inventory/reconciliation/backfill')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ orderIds: [999], dryRun: false });

    expect(backfillRes.status).toBe(403);
    expect(backfillRes.body.code).toBe('FORBIDDEN');
  });
});
