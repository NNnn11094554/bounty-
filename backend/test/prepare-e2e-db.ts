/**
 * Подготовка БД для e2e: применяет миграции и очищает таблицы.
 * Работает ТОЛЬКО с базой, имя которой оканчивается на _e2e или _test, — защита от случайного запуска на рабочей БД.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL ?? '';
const dbName = new URL(url).pathname.replace(/^\//, '');
if (!/_(e2e|test)$/.test(dbName)) {
  console.error(`Отказ: база "${dbName}" не похожа на тестовую (ожидается окончание _e2e или _test)`);
  process.exit(1);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
const prisma = new PrismaClient();
const tables = await prisma.$queryRaw<{ tablename: string }[]>`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
if (tables.length) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
// счастливый час по реальному времени и случайная золотая монета сделали бы сценарии непредсказуемыми
await prisma.appSetting.createMany({
  data: [
    { key: 'happyHour', value: { auto: false, override: null } },
    { key: 'goldenCoin', value: { enabled: false } },
  ],
});
await prisma.$disconnect();
console.warn(`e2e: база ${dbName} готова`);
