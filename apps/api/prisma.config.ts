import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Resolve .env from project root (same strategy as the app's env.ts)
function findEnvFile(): string | undefined {
  const cwdEnv = path.join(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) return cwdEnv;

  let dir = import.meta.dirname;
  const root = path.parse(dir).root;
  while (dir !== root) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    dir = path.dirname(dir);
  }
  return undefined;
}

const envFile = findEnvFile();
if (envFile) config({ path: envFile });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
