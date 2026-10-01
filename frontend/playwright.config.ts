import { defineConfig, devices } from '@playwright/test';

const E2E_DB =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://meowgul:meowgul@localhost:5432/meowgul_e2e';

/**
 * E2E: production-сборка фронтенда в режиме e2e (моковый initData разрешён) + API на тестовой БД.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
  },
  webServer: [
    {
      command: 'npx tsx test/prepare-e2e-db.ts && npx tsx src/index.ts',
      cwd: '../backend',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: E2E_DB,
        PORT: '3000',
        LOG_LEVEL: 'warn',
        ADMIN_TELEGRAM_IDS: '700000001',
      },
    },
    {
      command: 'npx vite build --mode e2e && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
