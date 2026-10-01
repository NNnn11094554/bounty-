import type { User } from '@prisma/client';
import { accruePassive, type PassiveAccrual } from '../game/passive.js';
import { applyBalanceChanges } from './ledger.js';
import type { Tx } from './userLock.js';

/**
 * Синхронизация в начале любой операции игрока: начислить пассивный доход с прошлого раза
 * (не больше 3 часов) и отметить время. Вызывается внутри withUserLock.
 */
export async function syncPassive(
  tx: Tx,
  user: User,
  now: Date,
): Promise<{ user: User; passive: PassiveAccrual }> {
  const passive = accruePassive(user.profitPerHour, user.lastSyncAt, now);
  const updated = await applyBalanceChanges(
    tx,
    user,
    [{ type: 'passive', amount: passive.amount }],
    { lastSyncAt: now, lastSeenAt: now },
    now,
  );
  return { user: updated, passive };
}
