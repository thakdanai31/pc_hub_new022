import { pinoHttp } from 'pino-http';
import { env } from '../config/env.js';

export const requestLogger = pinoHttp({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});
