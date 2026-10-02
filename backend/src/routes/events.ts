import type { GoldenCoinClaimResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EVENTS } from '../game/config/events.js';
import { ApiError } from '../lib/errors.js';
import { checkAchievements } from '../services/achievements.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const Params = z.object({ id: z.string().uuid() });

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Поймать золотую монету: только свою, один раз и только пока она на экране
   * (с запасом на сеть). Слишком быстрый «клик» сразу после появления — не человек.
   */
  app.post(
    '/api/events/:id/claim',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request): Promise<GoldenCoinClaimResponse> => {
      const { id } = Params.parse(request.params);
      const player = await requirePlayer(request);
      // слишком ранняя попытка помечается, поэтому ошибка бросается после транзакции (иначе пометка откатится)
      const result = await withUserLock(
        player.id,
        async (tx, locked): Promise<GoldenCoinClaimResponse | 'too_early'> => {
          const now = new Date();
          const event = await tx.userEvent.findUnique({ where: { id } });
          if (!event || event.userId !== locked.id || event.kind !== 'golden_coin') {
            throw new ApiError('NOT_FOUND', 'Event not found');
          }
          if (event.claimedAt) throw new ApiError('ALREADY_DONE', 'Coin is already caught');
          const cfg = EVENTS.goldenCoin;
          if (now.getTime() < event.appearsAt.getTime() + cfg.minReactionMs) {
            await tx.user.update({ where: { id: locked.id }, data: { suspiciousScore: { increment: 1 } } });
            return 'too_early';
          }
          if (now.getTime() > event.expiresAt.getTime() + cfg.graceMs) {
            throw new ApiError('NOT_COMPLETED', 'The coin has run away');
          }
          await tx.userEvent.update({ where: { id }, data: { claimedAt: now } });
          const { user } = await syncPassive(tx, locked, now);
          const reward = Number(event.reward);
          const updated = await applyBalanceChanges(
            tx,
            user,
            [{ type: 'golden_coin', amount: reward, meta: { eventId: id } }],
            {},
            now,
          );
          const final = await checkAchievements(tx, updated, now, ['goldenCoins']);
          return { state: buildPlayerState(final, now), reward };
        },
      );
      if (result === 'too_early') {
        request.log.warn({ userId: player.id, eventId: id }, 'golden coin caught too early');
        throw new ApiError('VALIDATION', 'Too early');
      }
      return result;
    },
  );
}
