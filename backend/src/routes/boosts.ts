import type { BoostType, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dailyBoostUsage, fullEnergyCooldownUntil } from '../game/boosts.js';
import { BOOSTS, boostLevelPrice } from '../game/config/boosts.js';
import { GAME, maxEnergy } from '../game/config/game.js';
import { currentEnergy } from '../game/energy.js';
import { ApiError } from '../lib/errors.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const Params = z.object({ type: z.enum(['full-energy', 'turbo', 'multitap', 'energy-limit']) });

export async function boostRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/boost/:type', async (request): Promise<StateResponse> => {
    const { type } = Params.parse(request.params) as { type: BoostType };
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const usage = dailyBoostUsage(user, now);
      const daily = { boostsDayKey: usage.dayKey };

      if (type === 'full-energy') {
        if (usage.fullEnergyUsed >= BOOSTS.fullEnergy.perDay) {
          throw new ApiError('LIMIT_REACHED', 'Full energy is used up for today');
        }
        const cooldown = fullEnergyCooldownUntil(user.fullEnergyLastAt);
        if (cooldown && cooldown > now) {
          throw new ApiError('COOLDOWN', 'Full energy is on cooldown', { until: cooldown.getTime() });
        }
        const updated = await tx.user.update({
          where: { id: user.id },
          data: {
            ...daily,
            energy: maxEnergy(user.energyLimitLevel),
            energyUpdatedAt: now,
            fullEnergyUsedToday: usage.fullEnergyUsed + 1,
            turboUsedToday: usage.turboUsed,
            fullEnergyLastAt: now,
          },
        });
        return { state: buildPlayerState(updated, now) };
      }

      if (type === 'turbo') {
        if (usage.turboUsed >= BOOSTS.turbo.perDay)
          throw new ApiError('LIMIT_REACHED', 'Turbo is used up for today');
        if (user.turboUntil && user.turboUntil > now) {
          throw new ApiError('CONFLICT', 'Turbo is already active', { until: user.turboUntil.getTime() });
        }
        const updated = await tx.user.update({
          where: { id: user.id },
          data: {
            ...daily,
            turboUsedToday: usage.turboUsed + 1,
            fullEnergyUsedToday: usage.fullEnergyUsed,
            turboUntil: new Date(now.getTime() + GAME.turbo.durationSec * 1000),
          },
        });
        return { state: buildPlayerState(updated, now) };
      }

      const boost = type === 'multitap' ? 'multitap' : 'energyLimit';
      const current = boost === 'multitap' ? user.multitapLevel : user.energyLimitLevel;
      const next = current + 1;
      if (next > BOOSTS[boost].maxLevel) throw new ApiError('LIMIT_REACHED', 'Maximum level reached');
      const price = boostLevelPrice(boost, next);
      // энергию фиксируем на момент покупки, чтобы смена максимума не исказила восстановление
      const energy = currentEnergy(user, now);
      const updated = await applyBalanceChanges(
        tx,
        user,
        [{ type: 'boost_purchase', amount: -price, meta: { boost: type, level: next } }],
        {
          ...(boost === 'multitap' ? { multitapLevel: next } : { energyLimitLevel: next }),
          energy: energy.energy,
          energyUpdatedAt: energy.updatedAt,
        },
        now,
      );
      return { state: buildPlayerState(updated, now) };
    });
  });
}
