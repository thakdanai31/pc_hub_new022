import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod/v4';

function findEnvFile(): string | undefined {
  // 1. Check process.cwd() first (project root when run from root scripts)
  const cwdEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) {
    return cwdEnv;
  }

  // 2. Walk up from the directory of this file to find .env
  let dir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.parse(dir).root;

  while (dir !== root) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    dir = path.dirname(dir);
  }

  // 3. No .env found — production uses injected env vars
  return undefined;
}

const envFile = findEnvFile();
if (envFile) {
  config({ path: envFile });
}

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .refine((val) => val.startsWith('mysql://'), {
      message: 'DATABASE_URL must start with mysql://',
    }),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  PROMPTPAY_ID: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

// Fail fast if CORS_ORIGIN is wildcard in production
if (parsed.data.NODE_ENV === 'production' && parsed.data.CORS_ORIGIN === '*') {
  console.error('CORS_ORIGIN must not be "*" in production');
  process.exit(1);
}

export const env = parsed.data;
