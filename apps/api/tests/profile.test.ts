import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString } from './helpers.js';

const USER = {
  firstName: 'Profile',
  lastName: 'Tester',
  phoneNumber: '0891111111',
  email: 'profiletest@test.com',
  password: 'password123',
};

let token: string;

async function cleanDatabase() {
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany({ where: { email: USER.email } });
}

beforeAll(async () => {
  await cleanDatabase();
  const res = await request(app).post('/api/v1/auth/register').send(USER);
  token = getBodyString(res, 'data', 'accessToken');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/v1/account/profile', () => {
  it('returns the authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(USER.email);
    expect(res.body.data.firstName).toBe(USER.firstName);
    expect(res.body.data.lastName).toBe(USER.lastName);
    expect(res.body.data.phoneNumber).toBe(USER.phoneNumber);
    expect(res.body.data.role).toBe('CUSTOMER');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/account/profile');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/account/profile', () => {
  it('updates first name only', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Updated');
    expect(res.body.data.lastName).toBe(USER.lastName);
  });

  it('updates last name only', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ lastName: 'NewLast' });

    expect(res.status).toBe(200);
    expect(res.body.data.lastName).toBe('NewLast');
  });

  it('updates phone number only', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '0899999999' });

    expect(res.status).toBe(200);
    expect(res.body.data.phoneNumber).toBe('0899999999');
  });

  it('updates multiple fields at once', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Multi', lastName: 'Update', phoneNumber: '0888888888' });

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Multi');
    expect(res.body.data.lastName).toBe('Update');
    expect(res.body.data.phoneNumber).toBe('0888888888');
  });

  it('rejects empty body (no fields)', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('does not allow email change', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'hacker@evil.com', firstName: 'Hack' });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(USER.email);
    expect(res.body.data.firstName).toBe('Hack');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .send({ firstName: 'Anon' });

    expect(res.status).toBe(401);
  });
});
