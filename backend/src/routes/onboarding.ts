import { START_BONUS, type StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  /** Конец онбординга: стартовый бонус — один раз; повторный вызов ничего не начисляет. */
  app.post('/api/onboarding/complete', async (request): Promise<StateResponse> => {
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      if (user.onboardingDone) return { state: buildPlayerState(user, now) };
      const updated = await applyBalanceChanges(
        tx,
        user,
        [{ type: 'start_bonus', amount: START_BONUS, meta: {} }],
        { onboardingDone: true },
        now,
      );
      return { state: buildPlayerState(updated, now) };
    });
  });
}
