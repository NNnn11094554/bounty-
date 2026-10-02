import { D, type Decimal } from '../lib/money.js';
import { GAME } from './config/game.js';

export interface PassiveAccrual {
  amount: Decimal;
  /** сколько секунд реально оплачено (с учётом потолка) */
  creditedSeconds: number;
  /** сколько секунд прошло с прошлой синхронизации */
  elapsedSeconds: number;
}

/** Пассивный доход: profitPerHour × min(сек с прошлой синхронизации, 3 ч) / 3600. */
export function accruePassive(profitPerHour: bigint, lastSyncAt: Date, now: Date): PassiveAccrual {
  const elapsedMs = Math.max(0, now.getTime() - lastSyncAt.getTime());
  const capMs = GAME.passive.maxOfflineHours * 3_600_000;
  const creditedMs = Math.min(elapsedMs, capMs);
  const amount = profitPerHour > 0n ? D(profitPerHour).mul(creditedMs).div(3_600_000) : D(0);
  return {
    amount,
    creditedSeconds: Math.floor(creditedMs / 1000),
    elapsedSeconds: Math.floor(elapsedMs / 1000),
  };
}
