import type { User } from '@prisma/client';
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementMetric,
  type AchievementProgress,
} from '@meowgul/shared';
import { logger } from '../lib/logger.js';
import { toCoins } from '../lib/money.js';
import { afterBalanceChange, applyBalanceChanges } from './ledger.js';
import type { Tx } from './userLock.js';

let enabled = true;
/**
 * Выдача достижений включена всегда; интеграционные тесты других механик выключают её,
 * чтобы проверять точные суммы без наград за достижения.
 */
export function setAchievementsEnabled(value: boolean): void {
  enabled = value;
}

/** Показатели, которые считаются запросом к БД (остальные берутся из строки игрока). */
export const COUNTED_METRICS = [
  'cards',
  'cardsLevel10',
  'cardMaxLevel',
  'friends',
  'premiumFriends',
  'combos',
  'ciphers',
  'tasks',
  'goldenCoins',
  'daysPlayed',
] as const satisfies readonly AchievementMetric[];
export type CountedMetric = (typeof COUNTED_METRICS)[number];

/** Показатели из строки игрока — бесплатно, проверяются после каждого изменения баланса. */
export function rowMetrics(user: User): AchievementProgress {
  return {
    taps: Number(user.totalTaps),
    earned: toCoins(user.totalEarned),
    profitPerHour: Number(user.profitPerHour),
    league: user.leagueLevel,
    multitap: user.multitapLevel,
    energyLimit: user.energyLimitLevel,
    dailyStreak: user.bestDailyStreak,
    wallet: user.walletAddress ? 1 : 0,
    hq: user.hqId ? 1 : 0,
  };
}

/** Показатели, требующие подсчёта в БД (только запрошенные). */
export async function countedMetrics(
  tx: Tx,
  userId: number,
  metrics: readonly CountedMetric[],
): Promise<AchievementProgress> {
  const want = new Set(metrics);
  const out: AchievementProgress = {};
  const jobs: Array<[CountedMetric, () => Promise<number>]> = [];
  const job = (metric: CountedMetric, run: () => Promise<number>) => {
    if (want.has(metric)) jobs.push([metric, run]);
  };
  job('cards', () => tx.userCard.count({ where: { userId, level: { gte: 1 } } }));
  job('cardsLevel10', () => tx.userCard.count({ where: { userId, level: { gte: 10 } } }));
  job('cardMaxLevel', async () => {
    const agg = await tx.userCard.aggregate({ where: { userId }, _max: { level: true } });
    return agg._max.level ?? 0;
  });
  job('friends', () => tx.referral.count({ where: { inviterId: userId } }));
  job('premiumFriends', () => tx.referral.count({ where: { inviterId: userId, isPremium: true } }));
  job('combos', () => tx.userComboProgress.count({ where: { userId, rewarded: true } }));
  job('ciphers', () => tx.userCipher.count({ where: { userId, solved: true } }));
  job('tasks', () => tx.userTask.count({ where: { userId, status: 'DONE' } }));
  job('goldenCoins', () =>
    tx.userEvent.count({ where: { userId, kind: 'golden_coin', claimedAt: { not: null } } }),
  );
  job('daysPlayed', () => tx.userActivity.count({ where: { userId } }));
  // запросы одной транзакции идут по одному соединению — выполняем последовательно
  for (const [metric, run] of jobs) out[metric] = await run();
  return out;
}

/** Достижения, условия которых выполнены, но которые ещё не получены. */
export function freshAchievements(user: User, progress: AchievementProgress): Achievement[] {
  const owned = new Set(user.achievementIds);
  return ACHIEVEMENTS.filter((a) => {
    const value = progress[a.metric];
    return value !== undefined && value >= a.threshold && !owned.has(a.id);
  });
}

/**
 * Выдать достижения, условия которых выполнены: запись в журнал, награда через ledger,
 * id — в список «новых» для всплывающего уведомления. Вызывается внутри withUserLock.
 * metrics — какие подсчитываемые показатели проверить (показатели из строки игрока проверяются всегда).
 */
export async function checkAchievements(
  tx: Tx,
  user: User,
  now: Date,
  metrics: readonly CountedMetric[] = [],
): Promise<User> {
  if (!enabled) return user;
  const counted = metrics.length ? await countedMetrics(tx, user.id, metrics) : {};
  return grant(tx, user, { ...rowMetrics(user), ...counted }, now);
}

async function grant(tx: Tx, user: User, progress: AchievementProgress, now: Date): Promise<User> {
  if (!enabled) return user;
  const fresh = freshAchievements(user, progress);
  if (fresh.length === 0) return user;
  const ids = fresh.map((a) => a.id);
  await tx.userAchievement.createMany({
    data: ids.map((achievementId) => ({ userId: user.id, achievementId, unlockedAt: now })),
    skipDuplicates: true,
  });
  logger.info({ userId: user.id, achievements: ids }, 'achievements unlocked');
  // награда сама может открыть новые достижения (заработок, лига) — их выдаст хук после этого начисления
  return applyBalanceChanges(
    tx,
    user,
    fresh.map((a) => ({
      type: 'achievement_reward' as const,
      amount: a.reward,
      meta: { achievementId: a.id },
    })),
    { achievementIds: { push: ids }, newAchievementIds: { push: ids } },
    now,
  );
}

// после любого изменения баланса проверяем показатели из строки игрока (тапы, заработок, лига, бусты…)
afterBalanceChange((tx, user, now) => grant(tx, user, rowMetrics(user), now));
