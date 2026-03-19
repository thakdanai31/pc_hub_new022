import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { extractCookie, getBodyString } from './helpers.js';

const TEST_USER = {
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '0812345678',
  email: 'john@test.com',
  password: 'password123',
};

async function cleanDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('registers a new customer and returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.firstName).toBe(TEST_USER.firstName);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = extractCookie(res, 'refresh_token');
    expect(cookie).not.toBeNull();

    const cookieStr = Array.isArray(res.headers['set-cookie'])
      ? res.headers['set-cookie'].join('; ')
      : String(res.headers['set-cookie']);
    expect(cookieStr).toContain('HttpOnly');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(TEST_USER);
    const res = await request(app).post('/api/v1/auth/register').send(TEST_USER);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await request(app).post('/api/v1/auth/register').send(TEST_USER);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);

    const cookie = extractCookie(res, 'refresh_token');
    expect(cookie).not.toBeNull();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects nonexistent email with same error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects disabled user', async () => {
    await prisma.user.updateMany({
      where: { email: TEST_USER.email },
      data: { isActive: false },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  let refreshCookie: string;

  beforeEach(async () => {
    await cleanDatabase();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);
    refreshCookie = extractCookie(reg, 'refresh_token')!;
  });

  it('refreshes tokens with valid cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();

    const newCookie = extractCookie(res, 'refresh_token');
    expect(newCookie).not.toBeNull();
  });

  it('rejects missing cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_REFRESH_TOKEN');
  });

  it('rejects reused (already rotated) token', async () => {
    // First refresh — rotates the token
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    // Second refresh with old cookie — reuse detection
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSE');
  });
});

describe('POST /api/v1/auth/logout', () => {
  let refreshCookie: string;

  beforeEach(async () => {
    await cleanDatabase();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);
    refreshCookie = extractCookie(reg, 'refresh_token')!;
  });

  it('logs out and clears cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);

    const cookies = res.headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies);
    expect(cookieStr).toContain('refresh_token=;');
  });

  it('succeeds even without cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
  });

  it('subsequent refresh fails after logout', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send(TEST_USER);
    accessToken = getBodyString(reg, 'data', 'accessToken');
  });

  it('returns current user with valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(TEST_USER.email);
    expect(res.body.data.firstName).toBe(TEST_USER.firstName);
    expect(res.body.data.role).toBe('CUSTOMER');
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
