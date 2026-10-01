import type { TapResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GAME, tapValue } from '../game/config/game.js';
import { currentEnergy } from '../game/energy.js';
import { accruePassive } from '../game/passive.js';
import { evaluateTaps } from '../game/tap.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const TapBody = z.object({
  /** номер пачки: растёт на 1 с каждой новой пачкой, повтор той же пачки — тот же номер */
  seq: z.number().int().min(1).max(2_147_483_647),
  taps: z.number().int().min(0).max(5_000),
  clientTime: z.number().optional(),
});

export async function tapRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/tap',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request): Promise<TapResponse> => {
      const body = TapBody.parse(request.body);
      const player = await requirePlayer(request);
      return withUserLock(player.id, async (tx, user) => {
        const now = new Date();
        if (body.seq <= user.lastTapSeq) {
          // повтор уже обработанной пачки (сеть оборвалась после ответа или подделка) — ничего не начисляем
          const synced = await syncPassive(tx, user, now);
          return { state: buildPlayerState(synced.user, now), accepted: 0, duplicate: true };
        }
        const energy = currentEnergy(user, now);
        const turboActive = Boolean(user.turboUntil && user.turboUntil > now);
        const result = evaluateTaps({
          requested: body.taps,
          energy: energy.energy,
          tapValue: tapValue(user.multitapLevel),
          sinceLastSyncMs: now.getTime() - user.lastTapAt.getTime(),
          turboActive,
          turboMultiplier: GAME.turbo.multiplier,
          eventMultiplier: 1,
        });
        if (result.suspicious) {
          request.log.warn(
            { userId: user.id, requested: body.taps, accepted: result.accepted },
            'tap rate exceeded',
          );
        }
        const passive = accruePassive(user.profitPerHour, user.lastSyncAt, now);
        const updated = await applyBalanceChanges(
          tx,
          user,
          [
            { type: 'passive', amount: passive.amount },
            { type: 'tap', amount: result.earned },
          ],
          {
            energy: energy.energy - result.energySpent,
            energyUpdatedAt: energy.updatedAt,
            lastTapAt: now,
            lastTapSeq: body.seq,
            totalTaps: { increment: result.accepted },
            lastSyncAt: now,
            lastSeenAt: now,
            ...(result.suspicious ? { suspiciousScore: { increment: 1 } } : {}),
          },
          now,
        );
        return { state: buildPlayerState(updated, now), accepted: result.accepted, duplicate: false };
      });
    },
  );
}
