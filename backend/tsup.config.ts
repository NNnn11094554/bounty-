import { defineConfig } from 'tsup';

// Бэкенд собирается в один ESM-файл; общий пакет @meowgul/shared вшивается в бандл,
// node_modules (Prisma, Fastify, grammY) остаются внешними.
export default defineConfig({
  // seed — для запуска на сервере без tsx: node dist/seed.js [--force]
  entry: { index: 'src/index.ts', seed: 'src/scripts/seed.ts' },
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  noExternal: ['@meowgul/shared'],
});
