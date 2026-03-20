import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { extractCookie, getBodyString } from './helpers.js';
import { hashToken } from '../src/utils/token.js';
import * as passwordResetMailService from '../src/modules/auth/password-reset-mail.service.js';

const TEST_USER = {
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: '0812345678',
  email: 'john@test.com',
  password: 'password123',
};

const originalNodeEnv = env.NODE_ENV;
const originalAppWebUrl = env.APP_WEB_URL;
const originalMailFrom = env.MAIL_FROM;
const originalSmtpHost = env.SMTP_HOST;
const originalSmtpPort = env.SMTP_PORT;
const originalSmtpSecure = env.SMTP_SECURE;
const originalSmtpUser = env.SMTP_USER;
const originalSmtpPass = env.SMTP_PASS;

async function cleanDatabase() {
  await prisma.claim.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.paymentSlip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();

  env.NODE_ENV = originalNodeEnv;
  env.APP_WEB_URL = originalAppWebUrl;
  env.MAIL_FROM = originalMailFrom;
  env.SMTP_HOST = originalSmtpHost;
  env.SMTP_PORT = originalSmtpPort;
  env.SMTP_SECURE = originalSmtpSecure;
  env.SMTP_USER = originalSmtpUser;
  env.SMTP_PASS = originalSmtpPass;
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

  it('rejects duplicate phone number', async () => {
    await request(app).post('/api/v1/auth/register').send(TEST_USER);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...TEST_USER,
        email: 'john-phone-duplicate@test.com',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('PHONE_TAKEN');
  });

  it('normalizes phone numbers before checking uniqueness', async () => {
    const firstEmail = 'john-normalized-1@test.com';
    const secondEmail = 'john-normalized-2@test.com';

    const firstRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...TEST_USER,
        email: firstEmail,
        phoneNumber: '081-234 5678',
      });

    expect(firstRes.status).toBe(201);

    const createdUser = await prisma.user.findUnique({
      where: { email: firstEmail },
      select: { phoneNumber: true },
    });

    expect(createdUser?.phoneNumber).toBe('0812345678');

    const secondRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...TEST_USER,
        email: secondEmail,
        phoneNumber: '081 234-5678',
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.code).toBe('PHONE_TAKEN');
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

  it('allows login again after a temporary ban has already expired', async () => {
    await prisma.user.updateMany({
      where: { email: TEST_USER.email },
      data: {
        isActive: false,
        bannedUntil: new Date(Date.now() - 60 * 1000),
        banReason: 'Temporary hold',
        bannedAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
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
});

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await request(app).post('/api/v1/auth/register').send(TEST_USER);
    env.NODE_ENV = originalNodeEnv;
    env.APP_WEB_URL = originalAppWebUrl;
    env.MAIL_FROM = originalMailFrom;
    env.SMTP_HOST = originalSmtpHost;
    env.SMTP_PORT = originalSmtpPort;
    env.SMTP_SECURE = originalSmtpSecure;
    env.SMTP_USER = originalSmtpUser;
    env.SMTP_PASS = originalSmtpPass;
    vi.restoreAllMocks();
  });

  it('returns a safe response and stores a hashed reset token for an existing user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent shortly.',
    );

    const resetLink = getBodyString(res, 'data', 'resetLink');
    const token = new URL(resetLink).searchParams.get('token');

    expect(token).toBeTruthy();

    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { id: true },
    });

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
    });

    expect(resetToken).not.toBeNull();
    expect(resetToken?.tokenHash).toBe(hashToken(token!));
    expect(resetToken?.tokenHash).not.toBe(token);
    expect(resetToken?.usedAt).toBeNull();
    expect(resetToken?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns the same safe response for a non-existing email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent shortly.',
    );
    expect(res.body.data).toBeNull();

    const tokenCount = await prisma.passwordResetToken.count();
    expect(tokenCount).toBe(0);
  });

  it('does not expose resetLink in production and sends the email instead', async () => {
    env.NODE_ENV = 'production';
    env.APP_WEB_URL = 'https://pchub.example.com';
    env.MAIL_FROM = 'PC Hub <no-reply@pchub.example.com>';
    env.SMTP_HOST = 'smtp.example.com';
    env.SMTP_PORT = 587;
    env.SMTP_SECURE = false;

    const sendSpy = vi
      .spyOn(passwordResetMailService, 'sendPasswordResetEmail')
      .mockResolvedValue();

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TEST_USER.email,
        firstName: TEST_USER.firstName,
        expiresMinutes: 30,
      }),
    );
    expect(sendSpy.mock.calls[0]?.[0].resetLink).toContain(
      'https://pchub.example.com/reset-password?token=',
    );
  });

  it('still exposes the debug resetLink in non-production while sending email if configured', async () => {
    env.NODE_ENV = 'development';
    env.APP_WEB_URL = 'http://localhost:4200';
    env.MAIL_FROM = 'PC Hub <no-reply@localhost>';
    env.SMTP_HOST = 'localhost';
    env.SMTP_PORT = 1025;
    env.SMTP_SECURE = false;

    const sendSpy = vi
      .spyOn(passwordResetMailService, 'sendPasswordResetEmail')
      .mockResolvedValue();

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getBodyString(res, 'data', 'resetLink')).toContain(
      'http://localhost:4200/reset-password?token=',
    );
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  let resetToken: string;

  beforeEach(async () => {
    await cleanDatabase();
    await request(app).post('/api/v1/auth/register').send(TEST_USER);

    const forgotPasswordRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: TEST_USER.email });

    const resetLink = getBodyString(forgotPasswordRes, 'data', 'resetLink');
    resetToken = new URL(resetLink).searchParams.get('token')!;
  });

  it('resets password successfully with a valid token', async () => {
    const newPassword = 'newpassword123';

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: newPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(resetToken) },
    });

    expect(tokenRecord?.usedAt).not.toBeNull();

    const oldPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(oldPasswordLogin.status).toBe(401);
    expect(oldPasswordLogin.body.code).toBe('INVALID_CREDENTIALS');

    const newPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: newPassword });

    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.body.data.accessToken).toBeDefined();
  });

  it('rejects an invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'invalid-token', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('rejects an expired token', async () => {
    await prisma.passwordResetToken.update({
      where: { tokenHash: hashToken(resetToken) },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('RESET_TOKEN_EXPIRED');
  });

  it('rejects reuse of an already-used token', async () => {
    const firstRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'newpassword123' });

    expect(firstRes.status).toBe(200);

    const secondRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: resetToken, password: 'anotherpass123' });

    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.code).toBe('RESET_TOKEN_USED');
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

  it('refreshes successfully after a temporary ban has already expired', async () => {
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        isActive: false,
        bannedUntil: new Date(Date.now() - 60 * 1000),
        banReason: 'Temporary hold',
        bannedAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();

    const refreshedUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        isActive: true,
        bannedUntil: true,
        banReason: true,
        bannedAt: true,
        bannedByUserId: true,
      },
    });

    expect(refreshedUser?.isActive).toBe(true);
    expect(refreshedUser?.bannedUntil).toBeNull();
    expect(refreshedUser?.banReason).toBeNull();
    expect(refreshedUser?.bannedAt).toBeNull();
    expect(refreshedUser?.bannedByUserId).toBeNull();
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
