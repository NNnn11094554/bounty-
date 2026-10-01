import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app.js';
import { signInitData, type TelegramUser } from '../src/auth/initData.js';
import { env } from '../src/env.js';
import { prisma } from '../src/lib/db.js';
import { seedCards } from '../src/services/cards.js';
import { clearLeaderboardCache } from '../src/services/leaderboard.js';

export const TEST_TOKEN = env.BOT_TOKEN;

/** Очистить все таблицы тестовой БД и заново заполнить справочники. */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  // справочник карточек — как после старта сервера
  await seedCards();
  clearLeaderboardCache();
}

export function tgUser(id: number, extra: Partial<TelegramUser> = {}): TelegramUser {
  return {
    id,
    first_name: `Cat${id}`,
    username: `cat${id}`,
    language_code: 'ru',
    allows_write_to_pm: true,
    ...extra,
  };
}

export function initDataFor(user: TelegramUser, opts: { startParam?: string; authDate?: Date } = {}): string {
  return signInitData({ user, startParam: opts.startParam, authDate: opts.authDate }, TEST_TOKEN);
}

export function authHeader(user: TelegramUser, opts: { startParam?: string } = {}): Record<string, string> {
  return { authorization: `tma ${initDataFor(user, opts)}` };
}

export async function createApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false });
}

/** Клиент API от имени игрока. */
export function client(app: FastifyInstance, user: TelegramUser) {
  const headers = authHeader(user);
  return {
    get: (url: string): Promise<LightMyRequestResponse> => app.inject({ method: 'GET', url, headers }),
    post: (url: string, payload?: unknown): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'POST', url, headers, payload: payload as Record<string, unknown> }),
    put: (url: string, payload?: unknown): Promise<LightMyRequestResponse> =>
      app.inject({ method: 'PUT', url, headers, payload: payload as Record<string, unknown> }),
    del: (url: string): Promise<LightMyRequestResponse> => app.inject({ method: 'DELETE', url, headers }),
  };
}
