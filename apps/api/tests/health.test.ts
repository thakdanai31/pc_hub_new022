import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Health endpoints', () => {
  it('GET /api/v1/health returns 200', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'OK',
      data: null,
    });
  });

  it('GET /api/v1/ready returns 200 or 503', async () => {
    const res = await request(app).get('/api/v1/ready');
    // DB may or may not be running in test env
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('message');
  });
});

describe('Not found handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
      code: 'NOT_FOUND',
    });
  });
});
