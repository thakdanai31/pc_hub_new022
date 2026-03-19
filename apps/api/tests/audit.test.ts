import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { logAction, logActionBestEffort } from '../src/modules/audit/audit.service.js';
import { getBodyString } from './helpers.js';

const ADMIN_USER = {
  firstName: 'AuditAdmin',
  lastName: 'Tester',
  phoneNumber: '0800000001',
  email: 'auditadmin@test.com',
  password: 'password123',
};

let adminToken: string;
let adminUserId: number;

async function cleanDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
}

async function createAdminDirect(): Promise<{ id: number }> {
  const { hashPassword } = await import('../src/utils/password.js');
  const passwordHash = await hashPassword(ADMIN_USER.password);
  return prisma.user.create({
    data: {
      firstName: ADMIN_USER.firstName,
      lastName: ADMIN_USER.lastName,
      email: ADMIN_USER.email,
      phoneNumber: ADMIN_USER.phoneNumber,
      passwordHash,
      role: 'ADMIN',
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  await cleanDatabase();
  const admin = await createAdminDirect();
  adminUserId = admin.id;

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ADMIN_USER.email, password: ADMIN_USER.password });
  adminToken = getBodyString(loginRes, 'data', 'accessToken');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
});

describe('Audit Service — logAction (transactional)', () => {
  it('creates an audit record inside a transaction', async () => {
    await prisma.$transaction(async (tx) => {
      await logAction(tx, {
        actorUserId: adminUserId,
        action: 'TEST_ACTION',
        entityType: 'TestEntity',
        entityId: 1,
        metadata: { key: 'value' },
      });
    });

    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].actorUserId).toBe(adminUserId);
    expect(logs[0].action).toBe('TEST_ACTION');
    expect(logs[0].entityType).toBe('TestEntity');
    expect(logs[0].entityId).toBe(1);
    expect(logs[0].metadata).toEqual({ key: 'value' });
    expect(logs[0].createdAt).toBeInstanceOf(Date);
  });

  it('rolls back audit record when transaction fails', async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await logAction(tx, {
          actorUserId: adminUserId,
          action: 'SHOULD_ROLLBACK',
          entityType: 'TestEntity',
          entityId: 1,
        });

        // Force rollback
        throw new Error('Intentional rollback');
      });
    } catch {
      // Expected
    }

    const logs = await prisma.auditLog.findMany({
      where: { action: 'SHOULD_ROLLBACK' },
    });
    expect(logs).toHaveLength(0);
  });

  it('supports nullable entityId', async () => {
    await prisma.$transaction(async (tx) => {
      await logAction(tx, {
        actorUserId: adminUserId,
        action: 'TEST_NULL_ENTITY',
        entityType: 'Report',
        entityId: null,
      });
    });

    const logs = await prisma.auditLog.findMany({
      where: { action: 'TEST_NULL_ENTITY' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].entityId).toBeNull();
  });
});

describe('Audit Service — logActionBestEffort', () => {
  it('creates an audit record on success', async () => {
    await logActionBestEffort({
      actorUserId: adminUserId,
      action: 'BEST_EFFORT_OK',
      entityType: 'Report',
      entityId: null,
      metadata: { date: '2026-03-16' },
    });

    const logs = await prisma.auditLog.findMany({
      where: { action: 'BEST_EFFORT_OK' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata).toEqual({ date: '2026-03-16' });
  });

  it('does not throw on failure', async () => {
    // Use an invalid actorUserId (FK violation) to trigger failure
    await expect(
      logActionBestEffort({
        actorUserId: 999999,
        action: 'BEST_EFFORT_FAIL',
        entityType: 'Report',
        entityId: null,
      }),
    ).resolves.toBeUndefined();

    const logs = await prisma.auditLog.findMany({
      where: { action: 'BEST_EFFORT_FAIL' },
    });
    expect(logs).toHaveLength(0);
  });
});

describe('Audit integration — category toggle creates audit record', () => {
  let categoryId: number;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    const res = await request(app)
      .post('/api/v1/backoffice/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Audit Test Cat', slug: 'audit-test-cat' });

    categoryId = res.body.data.id as number;
    // Clear the CREATE audit log so we only see the toggle
    await prisma.auditLog.deleteMany();
  });

  it('creates an audit log when toggling category active state', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/categories/${categoryId}/toggle-active`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { action: 'CATEGORY_TOGGLE_ACTIVE' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorUserId).toBe(adminUserId);
    expect(logs[0].entityType).toBe('Category');
    expect(logs[0].entityId).toBe(categoryId);
    expect(logs[0].metadata).toEqual({ isActive: false });
  });
});
