import type { User } from '@prisma/client';
import type { Locale } from '@meowgul/shared';
import type { ValidatedInitData } from '../auth/initData.js';
import { maxEnergy } from '../game/config/game.js';
import { dayKey } from '../game/dayKey.js';
import { prisma } from '../lib/db.js';

const RU_LANGS = new Set(['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'hy', 'az']);

export function normalizeLocale(code: string | null | undefined): Locale {
  const base = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return RU_LANGS.has(base) ? 'ru' : 'en';
}

function profileData(tg: ValidatedInitData) {
  const u = tg.user;
  return {
    username: u.username ?? null,
    firstName: (u.first_name ?? '').slice(0, 128),
    lastName: u.last_name ? u.last_name.slice(0, 128) : null,
    photoUrl: u.photo_url ?? null,
    languageCode: normalizeLocale(u.language_code),
    isPremium: Boolean(u.is_premium),
    allowsWriteToPm: Boolean(u.allows_write_to_pm),
  };
}

/** Найти или создать игрока по данным Telegram; профиль обновляется при каждом входе. */
export async function upsertTelegramUser(
  tg: ValidatedInitData,
  now: Date = new Date(),
): Promise<{ user: User; isNew: boolean }> {
  const telegramId = BigInt(tg.user.id);
  const data = profileData(tg);
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) {
    const user = await prisma.user.update({ where: { id: existing.id }, data: { ...data, lastSeenAt: now } });
    return { user, isNew: false };
  }
  // createMany + skipDuplicates: параллельный первый вход того же игрока не падает на уникальности
  const created = await prisma.user.createMany({
    data: [
      {
        telegramId,
        ...data,
        // новый игрок начинает с полной энергией (значение по умолчанию в базе — старый максимум)
        energy: maxEnergy(1),
        energyUpdatedAt: now,
        lastSyncAt: now,
        lastSeenAt: now,
        lastTapAt: now,
      },
    ],
    skipDuplicates: true,
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  return { user, isNew: created.count === 1 };
}

/** Отметка активности за игровой день (для DAU/WAU/MAU и удержания). */
export async function recordActivity(userId: number, at: Date = new Date()): Promise<void> {
  await prisma.userActivity.createMany({ data: [{ userId, dayKey: dayKey(at) }], skipDuplicates: true });
}
