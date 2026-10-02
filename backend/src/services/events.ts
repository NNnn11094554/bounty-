import type { GoldenCoinEvent, HappyHourInfo } from '@meowgul/shared';
import type { User } from '@prisma/client';
import { EVENTS } from '../game/config/events.js';
import { dayKey, dayStart } from '../game/dayKey.js';
import type { AppSettings } from './settings.js';
import type { Tx } from './userLock.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Стабильный хеш строки (FNV-1a) — время счастливого часа одинаково у всех игроков. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Автоматический счастливый час игрового дня: случайный час в окне, начало кратно 15 минутам. */
export function autoHappyHour(key: string): HappyHourInfo {
  const cfg = EVENTS.happyHour;
  const slots = ((cfg.latestHourAfterReset - cfg.earliestHourAfterReset) * 60) / 15;
  const offsetMin = cfg.earliestHourAfterReset * 60 + (hash(`happy:${key}`) % (slots + 1)) * 15;
  const startsAt = dayStart(key).getTime() + offsetMin * MIN;
  return { startsAt, endsAt: startsAt + cfg.durationMin * MIN, multiplier: cfg.multiplier };
}

/** Ближайший счастливый час, который ещё не закончился (текущий или следующий). */
export function nextHappyHour(settings: AppSettings, now: Date): HappyHourInfo | null {
  const t = now.getTime();
  const candidates: HappyHourInfo[] = [];
  const o = settings.happyHour.override;
  if (o) {
    candidates.push({
      startsAt: Date.parse(o.startsAt),
      endsAt: Date.parse(o.endsAt),
      multiplier: o.multiplier,
    });
  }
  if (settings.happyHour.auto) {
    const today = dayKey(now);
    candidates.push(autoHappyHour(today));
    candidates.push(autoHappyHour(dayKey(new Date(dayStart(today).getTime() + DAY))));
  }
  return candidates.filter((c) => c.endsAt > t).sort((a, b) => a.startsAt - b.startsAt)[0] ?? null;
}

/** Множитель тапов сейчас: ×2 в счастливый час, иначе 1. */
export function happyHourMultiplier(settings: AppSettings, now: Date): number {
  const hh = nextHappyHour(settings, now);
  return hh && hh.startsAt <= now.getTime() ? hh.multiplier : 1;
}

let random: () => number = Math.random;
/** Источник случайности для появления золотой монеты (в тестах — предсказуемый). */
export function setEventRandom(fn: () => number): void {
  random = fn;
}

export function goldenCoinReward(profitPerHour: number): number {
  const cfg = EVENTS.goldenCoin;
  return Math.max(cfg.minReward, Math.round((profitPerHour * cfg.profitShare) / 100) * 100);
}

/**
 * Возможно, выпустить золотую монету после пачки тапов: случайно, не больше 3 в игровой день
 * и не чаще раза в 20 минут. Вызывается внутри withUserLock.
 */
export async function maybeSpawnGoldenCoin(
  tx: Tx,
  user: User,
  now: Date,
  settings: AppSettings,
): Promise<GoldenCoinEvent | null> {
  const cfg = EVENTS.goldenCoin;
  if (!settings.goldenCoin.enabled || random() >= cfg.chancePerBatch) return null;
  const since = dayStart(dayKey(now));
  const today = await tx.userEvent.findMany({
    where: { userId: user.id, kind: 'golden_coin', appearsAt: { gte: since } },
    orderBy: { appearsAt: 'desc' },
    select: { appearsAt: true },
  });
  if (today.length >= cfg.perDay) return null;
  const last = today[0]?.appearsAt.getTime() ?? 0;
  if (now.getTime() - last < cfg.minIntervalMin * MIN) return null;
  const appearsAt = new Date(now.getTime() + cfg.delayMs);
  const event = await tx.userEvent.create({
    data: {
      userId: user.id,
      kind: 'golden_coin',
      reward: BigInt(goldenCoinReward(Number(user.profitPerHour))),
      appearsAt,
      expiresAt: new Date(appearsAt.getTime() + cfg.visibleMs),
    },
  });
  return {
    id: event.id,
    appearsAt: event.appearsAt.getTime(),
    expiresAt: event.expiresAt.getTime(),
    reward: Number(event.reward),
  };
}
