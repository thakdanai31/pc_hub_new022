import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { getBodyString, getBodyNumber, getBodyArray } from './helpers.js';

const CUSTOMER = {
  firstName: 'Report',
  lastName: 'Customer',
  phoneNumber: '0811111111',
  email: 'reportcustomer@test.com',
  password: 'password123',
};

const STAFF = {
  firstName: 'Report',
  lastName: 'Staff',
  phoneNumber: '0822222222',
  email: 'reportstaff@test.com',
  password: 'password123',
};

const ADMIN = {
  firstName: 'Report',
  lastName: 'Admin',
  phoneNumber: '0833333333',
  email: 'reportadmin@test.com',
  password: 'password123',
};

const TEST_ADDRESS = {
  label: 'Home',
  recipientName: 'Report Customer',
  phoneNumber: '0811111111',
  line1: '789 Report St',
  district: 'Bangrak',
  subdistrict: 'Bangrak',
  province: 'Bangkok',
  postalCode: '10500',
};

let customerToken: string;
let staffToken: string;
let adminToken: string;
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

async function registerAndGetToken(userData: typeof CUSTOMER): Promise<string> {
  const res = await request(app).post('/api/v1/auth/register').send(userData);
  return getBodyString(res, 'data', 'accessToken');
}

async function promoteAndReLogin(email: string, password: string, role: 'STAFF' | 'ADMIN'): Promise<string> {
  await prisma.user.update({
    where: { email },
    data: { role },
  });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return getBodyString(loginRes, 'data', 'accessToken');
}

beforeAll(async () => {
  await cleanDatabase();

  // Register users
  customerToken = await registerAndGetToken(CUSTOMER);
  await registerAndGetToken(STAFF);
  staffToken = await promoteAndReLogin(STAFF.email, STAFF.password, 'STAFF');
  await registerAndGetToken(ADMIN);
  adminToken = await promoteAndReLogin(ADMIN.email, ADMIN.password, 'ADMIN');

  // Create address
  const addrRes = await request(app)
    .post('/api/v1/account/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(TEST_ADDRESS);
  addressId = getBodyNumber(addrRes, 'data', 'id');

  // Create catalog
  const cat = await prisma.category.create({
    data: { name: 'GPUs', slug: 'gpus', isActive: true },
  });
  categoryId = cat.id;

  const br = await prisma.brand.create({
    data: { name: 'NVIDIA', slug: 'nvidia', isActive: true },
  });
  brandId = br.id;

  const p = await prisma.product.create({
    data: {
      categoryId,
      brandId,
      name: 'RTX 4090',
      slug: 'rtx-4090',
      sku: 'GPU-RTX4090',
      description: 'Flagship GPU',
      price: 59900,
      stock: 20,
      isActive: true,
    },
  });
  productId = p.id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

function cleanOrders() {
  return prisma.$transaction([
    prisma.paymentSlip.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
  ]).then(() =>
    prisma.product.update({
      where: { id: productId },
      data: { stock: 20 },
    }),
  );
}

async function createOrder(paymentMethod: 'COD' | 'PROMPTPAY_QR' = 'COD') {
  const res = await request(app)
    .post('/api/v1/checkout/buy-now')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId,
      quantity: 1,
      addressId,
      paymentMethod,
    });
  return {
    orderId: getBodyNumber(res, 'data', 'id'),
    orderNumber: getBodyString(res, 'data', 'orderNumber'),
  };
}

// --- Daily Sales ---
describe('Daily Sales Reports', () => {
  beforeEach(cleanOrders);

  it('staff can get daily sales summary', async () => {
    await createOrder();

    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(1);
    expect(typeof res.body.data.completedRevenue).toBe('number');
    expect(typeof res.body.data.pendingRevenue).toBe('number');
    expect(Array.isArray(res.body.data.ordersByStatus)).toBe(true);
    expect(Array.isArray(res.body.data.ordersByPaymentMethod)).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('admin can get daily sales summary', async () => {
    await createOrder();

    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(1);
  });

  it('customer gets 403', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated gets 401', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales');

    expect(res.status).toBe(401);
  });

  it('default date returns today data', async () => {
    await createOrder();

    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(1);
    expect(res.body.data.date).toBeTruthy();
  });

  it('specific date returns correct data', async () => {
    await createOrder();

    // Today's date in Bangkok timezone (UTC+7)
    const now = new Date();
    const bangkokTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = bangkokTime.toISOString().slice(0, 10);

    const res = await request(app)
      .get(`/api/v1/backoffice/reports/daily-sales?date=${today}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe(today);
    expect(res.body.data.totalOrders).toBeGreaterThanOrEqual(1);
  });

  it('empty day returns zeros', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales?date=2020-01-01')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(0);
    expect(res.body.data.completedRevenue).toBe(0);
    expect(res.body.data.pendingRevenue).toBe(0);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('invalid date format returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales?date=not-a-date')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(400);
  });

  it('excel export returns correct content type', async () => {
    await createOrder();
    await prisma.user.update({
      where: { email: CUSTOMER.email },
      data: { firstName: 'สมชาย', lastName: 'ลูกค้าทดสอบ' },
    });

    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales/excel')
      .set('Authorization', `Bearer ${staffToken}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);

    const worksheet = workbook.getWorksheet('รายงานยอดขาย');
    expect(worksheet).toBeDefined();
    expect(worksheet!.getCell('A1').value).toBe('รายงานยอดขายประจำวัน (Daily Sales Report)');

    let thaiCustomerFound = false;
    worksheet!.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.value === 'สมชาย ลูกค้าทดสอบ') {
          thaiCustomerFound = true;
        }
      });
    });

    expect(thaiCustomerFound).toBe(true);
  });

  it('pdf export returns correct content type', async () => {
    await createOrder();
    await prisma.user.update({
      where: { email: CUSTOMER.email },
      data: { firstName: 'สมหญิง', lastName: 'รายงานไทย' },
    });

    const res = await request(app)
      .get('/api/v1/backoffice/reports/daily-sales/pdf')
      .set('Authorization', `Bearer ${staffToken}`)
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(res.body.includes(Buffer.from('Sarabun'))).toBe(true);
  });
});
