import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/database.js';

// Mock cloudinary before importing app
vi.mock('cloudinary', () => {
  let callCount = 0;
  const mockUploadStream = vi.fn((_options, callback) => {
    callCount++;
    const { Writable } = require('node:stream');
    const writable = new Writable({
      write(_chunk: Buffer, _encoding: string, done: () => void) {
        done();
      },
    });
    writable.on('finish', () => {
      callback(null, {
        secure_url: `https://res.cloudinary.com/test/image/upload/mock-${callCount}.jpg`,
        public_id: `pc-hub/products/mock-${callCount}`,
      });
    });
    return writable;
  });

  const mockDestroy = vi.fn().mockResolvedValue({ result: 'ok' });

  return {
    v2: {
      config: vi.fn(),
      uploader: {
        upload_stream: mockUploadStream,
        destroy: mockDestroy,
      },
    },
  };
});

// Must import app after mock setup
const { app } = await import('../src/app.js');

let adminToken: string;
let staffToken: string;
let categoryId: number;
let brandId: number;
let productId: number;

async function cleanAll() {
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
  email: string,
  role: string,
): Promise<string> {
  await request(app).post('/api/v1/auth/register').send({
    firstName: role,
    lastName: 'User',
    email,
    phoneNumber: '0800000000',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });

  if (role !== 'CUSTOMER') {
    await prisma.user.update({
      where: { email },
      data: { role },
    });
  }

  const loginRes = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'Password123!',
  });
  const token: unknown = loginRes.body?.data?.accessToken;
  if (typeof token !== 'string') throw new Error('Failed to get token');
  return token;
}

beforeAll(async () => {
  await cleanAll();

  // Set Cloudinary env vars so ensureCloudinaryConfigured() passes
  process.env['CLOUDINARY_CLOUD_NAME'] = 'test-cloud';
  process.env['CLOUDINARY_API_KEY'] = 'test-key';
  process.env['CLOUDINARY_API_SECRET'] = 'test-secret';

  adminToken = await registerAndGetToken('admin-img@test.com', 'ADMIN');
  staffToken = await registerAndGetToken('staff-img@test.com', 'STAFF');

  const catRes = await request(app)
    .post('/api/v1/backoffice/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'GPUs', slug: 'gpus-img' });
  categoryId = catRes.body.data.id;

  const brandRes = await request(app)
    .post('/api/v1/backoffice/brands')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'NVIDIA', slug: 'nvidia-img' });
  brandId = brandRes.body.data.id;

  const prodRes = await request(app)
    .post('/api/v1/backoffice/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      brandId,
      name: 'RTX 4090 IMG',
      slug: 'rtx-4090-img',
      sku: 'NV-4090-IMG',
      description: 'GPU for image tests',
      price: 59990,
      stock: 5,
    });
  productId = prodRes.body.data.id;
});

afterAll(async () => {
  delete process.env['CLOUDINARY_CLOUD_NAME'];
  delete process.env['CLOUDINARY_API_KEY'];
  delete process.env['CLOUDINARY_API_SECRET'];
  await cleanAll();
  await prisma.$disconnect();
});

// Create a small valid JPEG buffer (minimal JPEG: SOI + EOI markers)
function createTestJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

describe('POST /api/v1/backoffice/products/:productId/images', () => {
  it('admin uploads image', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'test.jpg')
      .field('altText', 'Front view')
      .field('sortOrder', '0');

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toContain('cloudinary.com');
    expect(res.body.data.altText).toBe('Front view');
    expect(res.body.data.sortOrder).toBe(0);
  });

  it('uploads second image with different sortOrder', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'test2.jpg')
      .field('sortOrder', '1');

    expect(res.status).toBe(201);
    expect(res.body.data.sortOrder).toBe(1);
  });

  it('returns 400 without image file', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('altText', 'No file');

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid MIME type', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent product', async () => {
    const res = await request(app)
      .post('/api/v1/backoffice/products/99999/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'test.jpg');

    expect(res.status).toBe(404);
  });

  it('staff cannot upload (403)', async () => {
    const res = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', createTestJpeg(), 'test.jpg');

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/backoffice/products/:productId/images/:imageId', () => {
  it('admin deletes image', async () => {
    // Upload first
    const uploadRes = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'to-delete.jpg')
      .field('altText', 'Delete me');

    const imageId: number = uploadRes.body.data.id;

    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 for image belonging to different product', async () => {
    // Upload an image to our product
    const uploadRes = await request(app)
      .post(`/api/v1/backoffice/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'orphan.jpg');

    const imageId: number = uploadRes.body.data.id;

    // Try to delete it via a different product ID
    const res = await request(app)
      .delete(`/api/v1/backoffice/products/99999/images/${imageId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for nonexistent image', async () => {
    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${productId}/images/99999`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('staff cannot delete image (403)', async () => {
    const res = await request(app)
      .delete(`/api/v1/backoffice/products/${productId}/images/1`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Product delete cleans up images', () => {
  it('deleting product removes associated images', async () => {
    // Create a product with images
    const prodRes = await request(app)
      .post('/api/v1/backoffice/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        categoryId,
        brandId,
        name: 'Delete With Images',
        slug: 'delete-with-images',
        sku: 'DWI-001',
        description: 'Has images',
        price: 100,
      });

    const pid: number = prodRes.body.data.id;

    await request(app)
      .post(`/api/v1/backoffice/products/${pid}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'img1.jpg');

    await request(app)
      .post(`/api/v1/backoffice/products/${pid}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', createTestJpeg(), 'img2.jpg');

    const deleteRes = await request(app)
      .delete(`/api/v1/backoffice/products/${pid}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);

    // Verify images are gone from DB
    const remainingImages = await prisma.productImage.count({
      where: { productId: pid },
    });
    expect(remainingImages).toBe(0);
  });
});
