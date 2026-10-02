import { INCOME_BOOST_MULTIPLIER } from '@meowgul/shared';
import { D, type Decimal } from '../lib/money.js';
import { GAME } from './config/game.js';

export interface PassiveAccrual {
  amount: Decimal;
  /** сколько секунд реально оплачено (с учётом потолка) */
  creditedSeconds: number;
  /** сколько секунд прошло с прошлой синхронизации */
  elapsedSeconds: number;
}

/**
 * Пассивный доход: profitPerHour × min(сек с прошлой синхронизации, 3 ч) / 3600.
 * Буст из магазина (boostUntil): оплаченные секунды до boostUntil считаются ×INCOME_BOOST_MULTIPLIER.
 */
export function accruePassive(
  profitPerHour: bigint,
  lastSyncAt: Date,
  now: Date,
  boostUntil: Date | null = null,
): PassiveAccrual {
  const elapsedMs = Math.max(0, now.getTime() - lastSyncAt.getTime());
  const capMs = GAME.passive.maxOfflineHours * 3_600_000;
  const creditedMs = Math.min(elapsedMs, capMs);
  // оплачиваются первые creditedMs после прошлой синхронизации; из них под бустом — до boostUntil
  const boostedMs = boostUntil
    ? Math.max(0, Math.min(creditedMs, boostUntil.getTime() - lastSyncAt.getTime()))
    : 0;
  const paidMs = creditedMs + boostedMs * (INCOME_BOOST_MULTIPLIER - 1);
  const amount = profitPerHour > 0n ? D(profitPerHour).mul(paidMs).div(3_600_000) : D(0);
  return {
    amount,
    creditedSeconds: Math.floor(creditedMs / 1000),
    elapsedSeconds: Math.floor(elapsedMs / 1000),
  };
}
