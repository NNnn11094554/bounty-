import type { Page } from '@playwright/test';
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

/**
 * Отметить лигу как уже показанную игроку: сцена «Новая лига» не перекроет сценарий,
 * если тест сам поднимает игроку заработанное.
 */
export async function markLeagueSeen(page: Page, telegramId: number, level: number): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(telegramId) } });
  await page.evaluate(
    ([id, lvl]) => localStorage.setItem(`meowgul.league.${id}`, String(lvl)),
    [user.id, level],
  );
}

/** Ключ игрового дня (сброс в 16:00 UTC), offsetDays — сдвиг в днях. */
export function gameDay(offsetDays = 0): string {
  return new Date(Date.now() - 16 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
