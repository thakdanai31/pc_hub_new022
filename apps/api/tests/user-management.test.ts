import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getBodyArray } from './helpers.js';

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
let staffToken: string;
let adminToken: string;
let adminUserId: number;
let staffUserId: number;

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

  const c = await registerAndGetToken(CUSTOMER);
  customerToken = c.token;

  const s = await registerAndGetToken(STAFF);
  staffUserId = s.userId;
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');

  const a = await registerAndGetToken(ADMIN);
  adminUserId = a.userId;
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Privileged User Management', () => {
  it('admin can list privileged users', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeTruthy();
    // Should include at least the staff and admin from setup
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('list excludes CUSTOMER users', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const user of res.body.data) {
      expect(user.role).not.toBe('CUSTOMER');
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
    // Must not include passwordHash
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
        email: 'newstaff@test.com', // already created above
        phoneNumber: '0877777777',
        password: 'dupepass123',
      });

    expect(res.status).toBe(409);
  });

  it('admin can update user firstName', async () => {
    // Find the created staff user
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

  it('admin can disable another user', async () => {
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
  });

  it('created staff can log in with provided credentials', async () => {
    // Re-enable the staff user first (was disabled in prior test)
    await prisma.user.update({
      where: { email: 'newstaff@test.com' },
      data: { isActive: true },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newstaff@test.com', password: 'staffpass123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('STAFF');
  });
});
