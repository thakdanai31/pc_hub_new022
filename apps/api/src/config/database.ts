import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from './env.js';

function parseConnectionUrl(url: string): {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    port: parsed.port ? Number(parsed.port) : 3306,
  };
}

const dbConfig = parseConnectionUrl(env.DATABASE_URL);

const adapter = new PrismaMariaDb({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });
