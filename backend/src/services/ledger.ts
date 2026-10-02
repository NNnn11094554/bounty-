import type { Prisma, User } from '@prisma/client';
import { leagueForTotal } from '../game/config/leagues.js';
import { hourBucket } from '../game/dayKey.js';
import { ApiError } from '../lib/errors.js';
import { D, ZERO, type Decimal } from '../lib/money.js';
import type { Tx } from './userLock.js';

/** Типы операций журнала. Тапы и пассивный доход агрегируются по часу. */
export type TxType =
  | 'tap'
  | 'passive'
  | 'card_upgrade'
  | 'boost_purchase'
  | 'daily_reward'
  | 'combo_reward'
  | 'cipher_reward'
  | 'task_reward'
  | 'referral_bonus'
  | 'referral_league_bonus'
  | 'achievement_reward'
  | 'golden_coin'
  | 'hq_reward'
  | 'shop_purchase'
  | 'shop_refund'
  | 'cosmetic_purchase'
  | 'admin_adjustment';

const AGGREGATED: ReadonlySet<TxType> = new Set<TxType>(['tap', 'passive']);

/** Обработчики повышения лиги (бонусы пригласившему и т.п.) — вызываются в той же транзакции. */
export type LeagueUpHook = (tx: Tx, user: User, from: number, to: number) => Promise<void>;
const leagueUpHooks: LeagueUpHook[] = [];
export function onLeagueUp(hook: LeagueUpHook): void {
  leagueUpHooks.push(hook);
}

/**
 * Обработчики после любого изменения баланса (достижения по показателям игрока) — в той же транзакции.
 * Возвращают актуальную строку игрока.
 */
export type AfterChangeHook = (tx: Tx, user: User, now: Date) => Promise<User>;
const afterChangeHooks: AfterChangeHook[] = [];
export function afterBalanceChange(hook: AfterChangeHook): void {
  afterChangeHooks.push(hook);
}

export interface BalanceChange {
  type: TxType;
  amount: Decimal | number | bigint;
  meta?: Prisma.InputJsonValue;
  /** false — начисление не идёт в totalEarned (купленные монеты не двигают лигу и рейтинг) */
  earned?: boolean;
}

/**
 * ЕДИНСТВЕННЫЙ способ изменить баланс игрока. Вызывается внутри withUserLock.
 *  - начисления увеличивают balance и totalEarned (от totalEarned считается лига);
 *  - списания не опускают баланс ниже нуля (иначе INSUFFICIENT_FUNDS);
 *  - каждое изменение пишется в Transaction; тапы и пассивный доход — одной строкой за час.
 * extra — прочие поля игрока, которые нужно обновить тем же UPDATE (энергия, уровни и т.п.).
 */
export async function applyBalanceChanges(
  tx: Tx,
  user: User,
  changes: BalanceChange[],
  extra: Prisma.UserUpdateInput = {},
  now: Date = new Date(),
): Promise<User> {
  const items = changes.map((c) => ({ ...c, amount: D(c.amount) })).filter((c) => !c.amount.isZero());
  for (const c of items) {
    if (!c.amount.isFinite()) throw new ApiError('VALIDATION', 'Invalid amount');
  }
  const delta = items.reduce((sum, c) => sum.plus(c.amount), ZERO);
  const earned = items
    .filter((c) => c.amount.gt(0) && c.earned !== false)
    .reduce((sum, c) => sum.plus(c.amount), ZERO);
  const newBalance = user.balance.plus(delta);
  if (newBalance.lt(0)) {
    throw new ApiError('INSUFFICIENT_FUNDS', 'Not enough coins', {
      balance: user.balance.floor().toNumber(),
      required: delta.neg().floor().toNumber(),
    });
  }

  // лига — по всего заработанному, никогда не понижается
  const newLeague = Math.max(user.leagueLevel, leagueForTotal(user.totalEarned.plus(earned).toNumber()));
  const updated = await tx.user.update({
    where: { id: user.id },
    data: {
      ...extra,
      ...(items.length ? { balance: { increment: delta }, totalEarned: { increment: earned } } : {}),
      ...(newLeague !== user.leagueLevel ? { leagueLevel: newLeague } : {}),
    },
  });

  let running = user.balance;
  for (const c of items) {
    running = running.plus(c.amount);
    if (AGGREGATED.has(c.type)) {
      const bucket = hourBucket(now);
      await tx.transaction.upsert({
        where: { userId_type_bucket: { userId: user.id, type: c.type, bucket } },
        create: {
          userId: user.id,
          type: c.type,
          amount: c.amount,
          balanceAfter: running,
          bucket,
          meta: c.meta,
        },
        update: { amount: { increment: c.amount }, balanceAfter: running, count: { increment: 1 } },
      });
    } else {
      await tx.transaction.create({
        data: { userId: user.id, type: c.type, amount: c.amount, balanceAfter: running, meta: c.meta },
      });
    }
  }
  if (updated.leagueLevel > user.leagueLevel) {
    for (const hook of leagueUpHooks) await hook(tx, updated, user.leagueLevel, updated.leagueLevel);
  }
  let result = updated;
  for (const hook of afterChangeHooks) result = await hook(tx, result, now);
  return result;
}
