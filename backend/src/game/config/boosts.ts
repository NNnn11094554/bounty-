/**
 * Бусты. Бесплатные ежедневные — сбрасываются в DAILY_RESET_UTC_HOUR вместе с остальными активностями.
 * Платные — цена уровня N: baseCost × 2^(N−1), где N — уровень, который покупается.
 */
export const BOOSTS = {
  fullEnergy: { perDay: 6, cooldownSec: 3600 },
  turbo: { perDay: 3 },
  /** Multitap убран из усилителей: новые уровни не продаются, купленные раньше остаются (монет за тап) */
  multitap: { baseCost: 1000, maxLevel: 30 },
  energyLimit: { baseCost: 1000, maxLevel: 30 },
} as const;

export type PaidBoost = 'multitap' | 'energyLimit';

/** Цена покупки уровня level (2, 3, …). На 11 уровне = 1 024 000. */
export function boostLevelPrice(boost: PaidBoost, level: number): number {
  return BOOSTS[boost].baseCost * 2 ** (level - 1);
}
