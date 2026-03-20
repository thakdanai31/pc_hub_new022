import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import * as userAdminService from '../src/modules/backoffice/users/user-admin.service.js';
import { getBodyNumber, getBodyString } from './helpers.js';

const CUSTOMER = {
  firstName: 'UserMgmt',
  lastName: 'Customer',
  phoneNumber: '0811112222',
  email: 'usermgmtcustomer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'UserMgmt',
  lastName: 'Staff',
  phoneNumber: '0822223333',
  email: 'usermgmtstaff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'UserMgmt',
  lastName: 'Admin',
  phoneNumber: '0833334444',
  email: 'usermgmtadmin@test.com',
  password: 'password123',
};

let customerToken: string;
let customerUserId: number;
let staffToken: string;
let adminToken: string;
let adminUserId: number;

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

async function registerAndGetToken(
  userData: typeof CUSTOMER,
): Promise<{ token: string; userId: number }> {
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
): Promise<string> {
  await prisma.user.update({ where: { email }, data: { role } });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  return getBodyString(loginRes, 'data', 'accessToken');
}

beforeAll(async () => {
  await cleanDatabase();

  const customer = await registerAndGetToken(CUSTOMER);
  customerToken = customer.token;
  customerUserId = customer.userId;

  const staff = await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');

  const admin = await registerAndGetToken(ADMIN);
  adminUserId = admin.userId;
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Privileged User Management', () => {
  it('admin can list users including customers', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeTruthy();
    expect(res.body.data.some((user: { role: string }) => user.role === 'CUSTOMER')).toBe(true);
    expect(res.body.data.some((user: { role: string }) => user.role === 'STAFF')).toBe(true);
    expect(res.body.data.some((user: { role: string }) => user.role === 'ADMIN')).toBe(true);
  });

  it('admin can filter users by CUSTOMER role', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .query({ role: 'CUSTOMER' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const user of res.body.data) {
      expect(user.role).toBe('CUSTOMER');
    }
  });

  it('staff gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('customer gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated gets 401', async () => {
    const res = await request(app).get('/api/v1/backoffice/users');

    expect(res.status).toBe(401);
  });

  it('staff cannot disable customer accounts', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/users/${customerUserId}/disable`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('admin can create staff user', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'New',
        lastName: 'Staff',
        email: 'newstaff@test.com',
        phoneNumber: '0899999999',
        password: 'staffpass123',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('STAFF');
    expect(res.body.data.email).toBe('newstaff@test.com');
    expect(res.body.data.firstName).toBe('New');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('admin can create admin user', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/users/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'New',
        lastName: 'Admin',
        email: 'newadmin@test.com',
        phoneNumber: '0888888888',
        password: 'adminpass123',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('ADMIN');
    expect(res.body.data.email).toBe('newadmin@test.com');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('duplicate email returns 409', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/users/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Dupe',
        lastName: 'Staff',
        email: 'newstaff@test.com',
        phoneNumber: '0877777777',
        password: 'dupepass123',
      });

    expect(res.status).toBe(409);
  });

  it('admin can update user firstName', async () => {
    const staffUser = await prisma.user.findUnique({
      where: { email: 'newstaff@test.com' },
    });

    const res = await request(app)
      .patch(`/api/v1/backoffice/users/${staffUser!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Updated');
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('admin can ban a customer account', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/users/${customerUserId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('CUSTOMER');
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.bannedUntil).toBeNull();
    expect(res.body.data.banReason).toBeNull();
    expect(res.body.data.bannedAt).toBeTruthy();
    expect(res.body.data.bannedByUserId).toBe(adminUserId);
  });

  it('banned customers lose access to protected routes immediately', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('admin can unban a customer account', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/users/${customerUserId}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('CUSTOMER');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.bannedUntil).toBeNull();
    expect(res.body.data.banReason).toBeNull();
    expect(res.body.data.bannedAt).toBeNull();
    expect(res.body.data.bannedByUserId).toBeNull();
  });

  it('admin can temporarily ban a customer account', async () => {
    const bannedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/api/v1/backoffice/users/${customerUserId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        bannedUntil,
        banReason: 'Chargeback review',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('CUSTOMER');
    expect(res.body.data.isActive).toBe(false);
    expect(new Date(res.body.data.bannedUntil).toISOString()).toBe(bannedUntil);
    expect(res.body.data.banReason).toBe('Chargeback review');
    expect(res.body.data.bannedAt).toBeTruthy();
    expect(res.body.data.bannedByUserId).toBe(adminUserId);
  });

  it('temporarily banned customers lose access before expiry', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('expired temporary bans are lifted automatically on the next protected request', async () => {
    await prisma.user.update({
      where: { id: customerUserId },
      data: {
        isActive: false,
        bannedUntil: new Date(Date.now() - 60 * 1000),
        banReason: 'Expired review hold',
        bannedAt: new Date(Date.now() - 2 * 60 * 1000),
        bannedByUserId: adminUserId,
      },
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);

    const user = await prisma.user.findUnique({
      where: { id: customerUserId },
      select: {
        isActive: true,
        bannedUntil: true,
        banReason: true,
        bannedAt: true,
        bannedByUserId: true,
      },
    });

    expect(user?.isActive).toBe(true);
    expect(user?.bannedUntil).toBeNull();
    expect(user?.banReason).toBeNull();
    expect(user?.bannedAt).toBeNull();
    expect(user?.bannedByUserId).toBeNull();
  });

  it('admin can disable another staff user', async () => {
    const staffUser = await prisma.user.findUnique({
      where: { email: 'newstaff@test.com' },
    });

    const res = await request(app)
      .post(`/api/v1/backoffice/users/${staffUser!.id}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('admin cannot disable themselves', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/users/${adminUserId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELF_DISABLE');
  });

  it('service cannot disable the last active admin account', async () => {
    const secondAdmin = await prisma.user.findUnique({
      where: { email: 'newadmin@test.com' },
    });

    await prisma.user.update({ where: { id: adminUserId }, data: { isActive: false } });

    try {
      await expect(
        userAdminService.disableUser(secondAdmin!.id, adminUserId),
      ).rejects.toMatchObject({
        code: 'LAST_ACTIVE_ADMIN',
        statusCode: 400,
      });
    } finally {
      await prisma.user.update({
        where: { id: adminUserId },
        data: { isActive: true },
      });
    }
  });

  it('created staff can log in with provided credentials after re-enable', async () => {
    const staffUser = await prisma.user.findUnique({
      where: { email: 'newstaff@test.com' },
    });

    const enableRes = await request(app)
      .post(`/api/v1/backoffice/users/${staffUser!.id}/enable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.isActive).toBe(true);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newstaff@test.com', password: 'staffpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
    expect(loginRes.body.data.user.role).toBe('STAFF');
  });
});
