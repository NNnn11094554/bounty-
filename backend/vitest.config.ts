import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    // интеграционные тесты делят одну тестовую БД — выполняем файлы последовательно
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/game/**', 'src/auth/**', 'src/services/**'],
      reporter: ['text-summary', 'html'],
    },
  },
});
