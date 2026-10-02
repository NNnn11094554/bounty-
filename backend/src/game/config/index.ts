import type { GameConfig } from '@meowgul/shared';
import { env } from '../../env.js';
import { GAME } from './game.js';
import { LEAGUES } from './leagues.js';
import { REFERRAL, REWARDS } from './rewards.js';

/** Конфиг, который клиент получает при входе (только отображение — расчёты на сервере). */
export function clientConfig(): GameConfig {
  return {
    leagues: LEAGUES.map((l) => ({ ...l })),
    tap: { syncIntervalMs: GAME.tap.syncIntervalMs, maxPerSecond: GAME.tap.maxPerSecond },
    passive: { maxOfflineHours: GAME.passive.maxOfflineHours },
    turbo: { durationSec: GAME.turbo.durationSec, multiplier: GAME.turbo.multiplier },
    dailyResetUtcHour: env.DAILY_RESET_UTC_HOUR,
    dailyRewards: [...REWARDS.daily],
    referral: { regular: REFERRAL.regular, premium: REFERRAL.premium },
  };
}
