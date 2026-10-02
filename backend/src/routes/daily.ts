import type { DailyClaimResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { dailyRewardStatus } from '../game/daily.js';
import { ApiError } from '../lib/errors.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

export async function dailyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/daily-reward/claim', async (request): Promise<DailyClaimResponse> => {
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const status = dailyRewardStatus(user, now);
      if (status.claimedToday) {
        throw new ApiError('ALREADY_DONE', 'Daily reward is already claimed today', { day: status.day });
      }
      const streak = status.streak + 1;
      const updated = await applyBalanceChanges(
        tx,
        user,
        [{ type: 'daily_reward', amount: status.reward, meta: { day: status.day, streak } }],
        {
          dailyRewardDay: status.day,
          dailyRewardDayKey: status.dayKey,
          dailyRewardClaimedAt: now,
          dailyStreak: streak,
          bestDailyStreak: Math.max(user.bestDailyStreak, streak),
        },
        now,
      );
      return { state: buildPlayerState(updated, now), reward: status.reward, day: status.day };
    });
  });
}
