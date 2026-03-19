import { Router } from 'express';
import { prisma } from '../config/database.js';
import { sendSuccess, sendError } from '../common/response.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  sendSuccess({ res, message: 'OK' });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('DB connection timeout')), 3000);
    });
    await Promise.race([prisma.$queryRawUnsafe('SELECT 1'), timeout]);
    sendSuccess({ res, message: 'Ready' });
  } catch {
    sendError({
      res,
      message: 'Service unavailable',
      code: 'DB_NOT_READY',
      statusCode: 503,
    });
  }
});
