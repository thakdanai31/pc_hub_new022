import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod/v4';

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /put_|your_|change-me|example/i.test(value);
}

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
  CORS_ORIGIN: z.string().trim().min(1),
  APP_WEB_URL: z.string().trim().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  MAIL_FROM: z.string().trim().min(1).optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value?.trim() === 'true'),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASS: z.string().trim().min(1).optional(),
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

if (parsed.data.NODE_ENV === 'production') {
  if (!parsed.data.APP_WEB_URL) {
    console.error('APP_WEB_URL is required in production');
    process.exit(1);
  }

  if (
    !parsed.data.MAIL_FROM ||
    !parsed.data.SMTP_HOST ||
    !parsed.data.SMTP_PORT ||
    !parsed.data.SMTP_USER ||
    !parsed.data.SMTP_PASS
  ) {
    console.error(
      'MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS are required in production for Brevo SMTP password reset delivery',
    );
    process.exit(1);
  }
}

if ((parsed.data.SMTP_USER && !parsed.data.SMTP_PASS) || (!parsed.data.SMTP_USER && parsed.data.SMTP_PASS)) {
  console.error('SMTP_USER and SMTP_PASS must be provided together');
  process.exit(1);
}

const normalizedSmtpUser = trimOptionalString(parsed.data.SMTP_USER);
const normalizedSmtpPass = trimOptionalString(parsed.data.SMTP_PASS);

if (parsed.data.NODE_ENV === 'production') {
  if (looksLikePlaceholder(normalizedSmtpUser) || looksLikePlaceholder(normalizedSmtpPass)) {
    console.error(
      'SMTP_USER or SMTP_PASS still looks like a placeholder. For Brevo SMTP, use your SMTP login email address as SMTP_USER and your SMTP key as SMTP_PASS.',
    );
    process.exit(1);
  }
}

export const env = parsed.data;
