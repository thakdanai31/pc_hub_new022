import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? 'html' : 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: '../apps/api',
      port: 3000,
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
    {
      command: 'npm start',
      cwd: '../apps/web',
      port: 4200,
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ],
});
