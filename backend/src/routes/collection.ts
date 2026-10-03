import type { CollectionActionResponse, CollectionResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { buyWithCoins, collectionOf, equipCosmetic, ownedCosmetics } from '../services/cosmetics.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const Params = z.object({ id: z.string().min(1).max(40) });

/**
 * Коллекция: скины кота и эффекты тапа. Владение, уровень и цену проверяет сервер; премиальные
 * предметы покупаются за Stars через магазин (/api/shop/invoice).
 */
export async function collectionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/collection', async (request): Promise<CollectionResponse> => {
    const player = await requirePlayer(request);
    return collectionOf(player, await ownedCosmetics(prisma, player));
  });

  app.post('/api/collection/:id/buy', async (request): Promise<CollectionActionResponse> => {
    const { id } = Params.parse(request.params);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const updated = await buyWithCoins(tx, user, id, now);
      request.log.info({ userId: user.id, cosmeticId: id }, 'cosmetic bought');
      return {
        state: buildPlayerState(updated, now),
        ...collectionOf(updated, await ownedCosmetics(tx, updated)),
      };
    });
  });

  app.post('/api/collection/:id/equip', async (request): Promise<CollectionActionResponse> => {
    const { id } = Params.parse(request.params);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const updated = await equipCosmetic(tx, user, id);
      return {
        state: buildPlayerState(updated, now),
        ...collectionOf(updated, await ownedCosmetics(tx, updated)),
      };
    });
  });
}
