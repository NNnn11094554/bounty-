import { execSync } from 'node:child_process';

/** Перед всеми тестами приводим тестовую БД к актуальной схеме. */
export default function setup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL_TEST ??
    'postgresql://meowgul:meowgul@localhost:5432/meowgul_test';
  process.env.DATABASE_URL = url;
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url } });
}
