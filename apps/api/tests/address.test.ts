import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getBodyArray, getNumberProp, getBoolProp } from './helpers.js';

const TEST_USER = {
  firstName: 'Jane',
  lastName: 'Smith',
  phoneNumber: '0898765432',
  email: 'jane@test.com',
  password: 'password123',
};

const TEST_USER_2 = {
  firstName: 'Bob',
  lastName: 'Jones',
  phoneNumber: '0811112222',
  email: 'bob@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Jane Smith',
  phoneNumber: '0898765432',
  line1: '123 Main St',
  district: 'Chatuchak',
  subdistrict: 'Chatuchak',
  province: 'Bangkok',
  postalCode: '10900',
};

async function cleanDatabase() {
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

let token: string;
let token2: string;

beforeAll(async () => {
  await cleanDatabase();
  const r1 = await request(app).post('/api/v1/auth/register').send(TEST_USER);
  token = getBodyString(r1, 'data', 'accessToken');
  const r2 = await request(app).post('/api/v1/auth/register').send(TEST_USER_2);
  token2 = getBodyString(r2, 'data', 'accessToken');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('GET /api/v1/account/addresses', () => {
  beforeEach(async () => {
    await prisma.address.deleteMany();
  });

  it('returns empty array initially', async () => {
    const res = await request(app)
      .get('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/account/addresses');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/account/addresses', () => {
  beforeEach(async () => {
    await prisma.address.deleteMany();
  });

  it('creates an address', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(TEST_ADDRESS);

    expect(res.status).toBe(201);
    expect(res.body.data.label).toBe('Home');
    expect(res.body.data.recipientName).toBe('Jane Smith');
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'X' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/account/addresses/:addressId', () => {
  let addressId: number;

  beforeEach(async () => {
    await prisma.address.deleteMany();
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(TEST_ADDRESS);
    addressId = getBodyNumber(res, 'data', 'id');
  });

  it('updates own address', async () => {
    const res = await request(app)
      .patch(`/api/v1/account/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Office' });

    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('Office');
  });

  it('returns 404 when updating another user\'s address', async () => {
    const res = await request(app)
      .patch(`/api/v1/account/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ label: 'Hacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/account/addresses/:addressId', () => {
  let addressId: number;

  beforeEach(async () => {
    await prisma.address.deleteMany();
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(TEST_ADDRESS);
    addressId = getBodyNumber(res, 'data', 'id');
  });

  it('deletes own address', async () => {
    const res = await request(app)
      .delete(`/api/v1/account/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 when deleting another user\'s address', async () => {
    const res = await request(app)
      .delete(`/api/v1/account/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/account/addresses/:addressId/default', () => {
  let addr1Id: number;
  let addr2Id: number;

  beforeEach(async () => {
    await prisma.address.deleteMany();
    const r1 = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...TEST_ADDRESS, label: 'Home', isDefault: true });
    addr1Id = getBodyNumber(r1, 'data', 'id');

    const r2 = await request(app)
      .post('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...TEST_ADDRESS, label: 'Office' });
    addr2Id = getBodyNumber(r2, 'data', 'id');
  });

  it('sets new default and unsets old one', async () => {
    const res = await request(app)
      .post(`/api/v1/account/addresses/${addr2Id}/default`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isDefault).toBe(true);

    // Verify old default was unset
    const list = await request(app)
      .get('/api/v1/account/addresses')
      .set('Authorization', `Bearer ${token}`);

    const addresses = getBodyArray(list, 'data');
    const oldDefault = addresses.find((a) => getNumberProp(a, 'id') === addr1Id);
    expect(getBoolProp(oldDefault, 'isDefault')).toBe(false);
  });
});
