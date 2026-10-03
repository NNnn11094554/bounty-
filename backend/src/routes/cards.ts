import type { CardUpgradeResponse, CardsResponse, InvoiceResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cardLevelCost, cardLevelProfit } from '../game/config/cards.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/db.js';
import {
  buildCardViews,
  cardLock,
  getCatalog,
  getCatalogCard,
  limitedWindow,
  loadProgress,
  needsStars,
  runCardUpgradeHooks,
  visibleCards,
} from '../services/cards.js';
import { registerComboCard } from '../services/dailyGames.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { createAssetInvoice } from '../services/shop.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';
import { checkAchievements } from '../services/achievements.js';

const Params = z.object({ id: z.string().regex(/^[a-z0-9_]{1,64}$/) });

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/cards', async (request): Promise<CardsResponse> => {
    const user = await requirePlayer(request);
    const now = new Date();
    const [catalog, progress] = await Promise.all([getCatalog(), loadProgress(prisma, user)]);
    const cards = await buildCardViews(visibleCards(catalog, progress, now), progress, now);
    return { cards, serverTime: now.getTime() };
  });

  /** Счёт в Stars за открытие платного актива; оплату выдаёт бот, статус — GET /api/shop/purchases/:id. */
  app.post('/api/cards/:id/invoice', async (request): Promise<InvoiceResponse> => {
    const { id } = Params.parse(request.params);
    const player = await requirePlayer(request);
    const { purchase, link } = await createAssetInvoice(player, id);
    return { purchaseId: purchase.id, link };
  });

  app.post('/api/cards/:id/upgrade', async (request): Promise<CardUpgradeResponse> => {
    const { id } = Params.parse(request.params);
    const player = await requirePlayer(request);
    const card = await getCatalogCard(id);
    if (!card) throw new ApiError('NOT_FOUND', 'Card not found');

    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const catalog = await getCatalog();
      const progress = await loadProgress(tx, user);
      const level = progress.levels.get(card.id) ?? 0;

      if (!card.isActive) {
        if (level === 0) throw new ApiError('NOT_FOUND', 'Card not found');
        throw new ApiError('LOCKED', 'Card is no longer available', { reason: 'inactive' });
      }
      if (card.isLimited && !progress.devMode) {
        const window = limitedWindow(card, catalog, now);
        if (!window.active) {
          throw new ApiError('LOCKED', 'Card is not available now', {
            reason: 'limited',
            nextFrom: window.nextFrom?.getTime() ?? null,
          });
        }
      }
      const lock = cardLock(card, progress, new Map(catalog.map((c) => [c.id, c])));
      if (lock) throw new ApiError('LOCKED', 'Card is locked', { reason: 'condition', lock });
      // первый уровень платного актива — только через счёт в Stars (POST /api/cards/:id/invoice)
      if (needsStars(card, progress)) {
        throw new ApiError('LOCKED', 'Unlock this asset with Stars first', {
          reason: 'stars',
          stars: card.starsPrice,
        });
      }
      const cooldown = progress.cooldowns.get(card.id);
      if (cooldown && cooldown > now) {
        throw new ApiError('COOLDOWN', 'Card is on cooldown', { until: cooldown.getTime() });
      }
      if (level >= card.maxLevel) throw new ApiError('LIMIT_REACHED', 'Maximum level reached');

      const next = level + 1;
      const price = cardLevelCost(card, next);
      const profit = cardLevelProfit(card, next);
      const updated = await applyBalanceChanges(
        tx,
        user,
        [{ type: 'card_upgrade', amount: -price, meta: { cardId: card.id, level: next, profit } }],
        { profitPerHour: { increment: BigInt(profit) } },
        now,
      );
      const cooldownUntil = card.cooldownSec > 0 ? new Date(now.getTime() + card.cooldownSec * 1000) : null;
      await tx.userCard.upsert({
        where: { userId_cardId: { userId: user.id, cardId: card.id } },
        create: { userId: user.id, cardId: card.id, level: next, lastUpgradeAt: now, cooldownUntil },
        update: { level: next, lastUpgradeAt: now, cooldownUntil },
      });
      await runCardUpgradeHooks(tx, updated, card, next, now);
      const combo = await registerComboCard(tx, updated, card.id, now);

      progress.levels.set(card.id, next);
      if (!progress.devMode) progress.cooldowns.set(card.id, cooldownUntil);
      // карточка и те, что открываются её уровнем
      const affected = visibleCards(
        catalog,
        progress,
        now,
        (c) => c.id === card.id || (c.condition?.type === 'card' && c.condition.cardId === card.id),
      );
      const cards = await buildCardViews(affected, progress, now);
      const final = await checkAchievements(tx, combo.user, now, [
        'cards',
        'cardsLevel10',
        'cardMaxLevel',
        'combos',
      ]);
      return { state: buildPlayerState(final, now), cards, profitDelta: profit, combo: combo.update };
    });
  });
}
