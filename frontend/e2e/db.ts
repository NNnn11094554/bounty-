import { PrismaClient } from '@prisma/client';

/** Прямой доступ к e2e-базе: подготовить игрока (баланс, уровни) для сценариев. */
export const db = new PrismaClient({
  datasources: {
    // только E2E_DATABASE_URL: Prisma Client сам подмешивает DATABASE_URL из backend/.env (база разработки)
    db: { url: process.env.E2E_DATABASE_URL ?? 'postgresql://meowgul:meowgul@localhost:5432/meowgul_e2e' },
  },
});

export async function setPlayer(
  telegramId: number,
  data: Parameters<typeof db.user.update>[0]['data'],
): Promise<void> {
  await db.user.update({ where: { telegramId: BigInt(telegramId) }, data });
}
