import {
  CARD_CATEGORIES,
  CARD_GLYPHS,
  CARD_ICON_BADGES,
  CARD_PALETTES,
  CARD_RARITIES,
  CARD_TEXT_BADGES,
  TICKER_RE,
  type AdminCard,
  type AdminCardInput,
  type CardPreviewResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkCardsBalance } from '../../game/cardsBalance.js';
import { MAX_LEVEL_PRICE, cardLevelCost, cardLevelProfit, type CardConfig } from '../../game/config/cards.js';
import { LEAGUES } from '../../game/config/leagues.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import {
  cardFromRow,
  conditionToRow,
  getCatalog,
  invalidateCatalog,
  type CatalogCard,
} from '../../services/cards.js';
import { requireAdmin } from '../../services/player.js';

const ID_RE = /^[a-z0-9_]{2,40}$/;
const BADGES = [...CARD_ICON_BADGES, ...CARD_TEXT_BADGES] as readonly string[];

/**
 * Иконка "glyph/badge/palette" из каталога рисунков или монета "token/ТИКЕР/palette" — без произвольных
 * картинок и логотипов.
 */
const IconSchema = z.string().refine((icon) => {
  const [glyph, badge, palette] = icon.split('/');
  const p = Number(palette);
  const mark = glyph === 'token' ? TICKER_RE.test(badge ?? '') : BADGES.includes(badge ?? '');
  return (
    (CARD_GLYPHS as readonly string[]).includes(glyph ?? '') &&
    mark &&
    Number.isInteger(p) &&
    p >= 0 &&
    p < CARD_PALETTES.length
  );
}, 'Icon: glyph/badge/palette from the catalog or token/TICKER/palette');

const ConditionSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('card'),
      cardId: z.string().regex(ID_RE),
      level: z.number().int().min(1).max(100),
    }),
    z.object({ type: z.literal('friends'), count: z.number().int().min(1).max(10_000) }),
    z.object({ type: z.literal('task'), taskId: z.string().regex(/^[a-z0-9_]{1,64}$/) }),
    z.object({
      type: z.literal('league'),
      level: z
        .number()
        .int()
        .min(1)
        .max(LEAGUES.length - 1),
    }),
  ])
  .nullable();

const CardInput = z
  .object({
    category: z.enum(CARD_CATEGORIES),
    nameRu: z.string().trim().min(1).max(60),
    nameEn: z.string().trim().min(1).max(60),
    descRu: z.string().trim().max(200),
    descEn: z.string().trim().max(200),
    icon: IconSchema,
    rarity: z.enum(CARD_RARITIES),
    starsPrice: z.number().int().min(1).max(10_000).nullable(),
    baseCost: z.number().int().min(1).max(1_000_000_000_000),
    baseProfit: z.number().int().min(1).max(1_000_000_000_000),
    costMultiplier: z.number().min(1.01).max(5),
    profitMultiplier: z.number().min(1).max(3),
    maxLevel: z.number().int().min(1).max(100),
    cooldownSec: z
      .number()
      .int()
      .min(0)
      .max(7 * 86_400),
    condition: ConditionSchema,
    isLimited: z.boolean(),
    availableFrom: z.number().int().nullable(),
    availableUntil: z.number().int().nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(-1000).max(10_000),
  })
  .superRefine((c, ctx) => {
    if (c.availableFrom !== null && c.availableUntil !== null && c.availableUntil <= c.availableFrom) {
      ctx.addIssue({ code: 'custom', path: ['availableUntil'], message: 'Window end must be after start' });
    }
    if (cardLevelCost(c, c.maxLevel) > MAX_LEVEL_PRICE) {
      ctx.addIssue({ code: 'custom', path: ['maxLevel'], message: 'Price of the max level is too high' });
    }
  });

const Params = z.object({ id: z.string().regex(ID_RE) });
const CreateBody = z.object({ id: z.string().regex(ID_RE), card: CardInput });
const PreviewBody = z.object({ id: z.string().regex(ID_RE).optional(), card: CardInput });

function toAdmin(card: CatalogCard, owners: number): AdminCard {
  return {
    id: card.id,
    category: card.category,
    nameRu: card.nameRu,
    nameEn: card.nameEn,
    descRu: card.descRu,
    descEn: card.descEn,
    icon: card.icon,
    rarity: card.rarity,
    starsPrice: card.starsPrice,
    baseCost: card.baseCost,
    baseProfit: card.baseProfit,
    costMultiplier: card.costMultiplier,
    profitMultiplier: card.profitMultiplier,
    maxLevel: card.maxLevel,
    cooldownSec: card.cooldownSec,
    condition: card.condition,
    isLimited: card.isLimited,
    availableFrom: card.availableFrom?.getTime() ?? null,
    availableUntil: card.availableUntil?.getTime() ?? null,
    isActive: card.isActive,
    sortOrder: card.sortOrder,
    owners,
  };
}

function toRow(id: string, c: AdminCardInput) {
  return {
    id,
    category: c.category,
    nameRu: c.nameRu,
    nameEn: c.nameEn,
    descRu: c.descRu,
    descEn: c.descEn,
    icon: c.icon,
    rarity: c.rarity,
    starsPrice: c.starsPrice,
    baseCost: BigInt(c.baseCost),
    baseProfit: BigInt(c.baseProfit),
    costMultiplier: c.costMultiplier,
    profitMultiplier: c.profitMultiplier,
    maxLevel: c.maxLevel,
    cooldownSec: c.cooldownSec,
    ...conditionToRow(c.condition),
    isLimited: c.isLimited,
    availableFrom: c.availableFrom !== null ? new Date(c.availableFrom) : null,
    availableUntil: c.availableUntil !== null ? new Date(c.availableUntil) : null,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
  };
}

async function ownersCount(): Promise<Map<string, number>> {
  const rows = await prisma.userCard.groupBy({ by: ['cardId'], where: { level: { gte: 1 } }, _count: true });
  return new Map(rows.map((r) => [r.cardId, r._count]));
}

/** Условие должно ссылаться на существующую карточку/задание и не делать карточку условием самой себя. */
async function assertCondition(id: string, c: AdminCardInput): Promise<void> {
  const cond = c.condition;
  if (cond?.type === 'card') {
    if (cond.cardId === id) throw new ApiError('VALIDATION', 'A card cannot require itself');
    const target = await prisma.card.findUnique({ where: { id: cond.cardId } });
    if (!target) throw new ApiError('VALIDATION', `Unknown card ${cond.cardId}`);
    if (cond.level > target.maxLevel)
      throw new ApiError('VALIDATION', 'Required level is above the max level');
  }
  if (cond?.type === 'task' && !(await prisma.task.findUnique({ where: { id: cond.taskId } }))) {
    throw new ApiError('VALIDATION', `Unknown task ${cond.taskId}`);
  }
}

/** Уровни карточки с ценой, приростом прибыли и окупаемостью + замечания проверки баланса. */
export function previewCard(
  id: string,
  card: AdminCardInput,
  catalog: readonly CardConfig[],
): CardPreviewResponse {
  const levels = [];
  let total = 0;
  for (let level = 1; level <= card.maxLevel; level++) {
    const cost = cardLevelCost(card, level);
    const profit = cardLevelProfit(card, level);
    total += profit;
    levels.push({ level, cost, profit, totalProfit: total, paybackHours: cost / Math.max(1, profit) });
  }
  const config: CardConfig = { id, ...card };
  const report = checkCardsBalance([...catalog.filter((c) => c.id !== id), config]);
  const mine = (msg: string) => msg.startsWith(`${id}:`);
  return { levels, warnings: [...report.errors.filter(mine), ...report.warnings.filter(mine)] };
}

/** Карточки Mine в админке: список, превью экономики, создание, правка, удаление без владельцев. */
export async function adminCardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/cards', async (request): Promise<{ cards: AdminCard[] }> => {
    await requireAdmin(request);
    const [rows, owners] = await Promise.all([
      prisma.card.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
      ownersCount(),
    ]);
    return { cards: rows.map((r) => toAdmin(cardFromRow(r), owners.get(r.id) ?? 0)) };
  });

  app.post('/api/admin/cards/preview', async (request): Promise<CardPreviewResponse> => {
    await requireAdmin(request);
    const { id, card } = PreviewBody.parse(request.body);
    return previewCard(id ?? 'new_card', card, await getCatalog());
  });

  app.post('/api/admin/cards', async (request): Promise<{ card: AdminCard }> => {
    await requireAdmin(request);
    const { id, card } = CreateBody.parse(request.body);
    if (await prisma.card.findUnique({ where: { id } })) throw new ApiError('CONFLICT', 'Card id is taken');
    await assertCondition(id, card);
    const row = await prisma.card.create({ data: toRow(id, card) });
    invalidateCatalog();
    request.log.warn({ admin: request.tg?.user.id, cardId: id }, 'admin: card created');
    return { card: toAdmin(cardFromRow(row), 0) };
  });

  app.put('/api/admin/cards/:id', async (request): Promise<{ card: AdminCard }> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const card = CardInput.parse(request.body);
    if (!(await prisma.card.findUnique({ where: { id } }))) throw new ApiError('NOT_FOUND', 'Card not found');
    await assertCondition(id, card);
    const row = await prisma.card.update({ where: { id }, data: toRow(id, card) });
    invalidateCatalog();
    request.log.warn({ admin: request.tg?.user.id, cardId: id }, 'admin: card updated');
    return { card: toAdmin(cardFromRow(row), (await ownersCount()).get(id) ?? 0) };
  });

  /** Удалить можно только карточку, которую никто не покупал; иначе — выключить (isActive=false). */
  app.delete('/api/admin/cards/:id', async (request): Promise<{ ok: true }> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    if (!(await prisma.card.findUnique({ where: { id } }))) throw new ApiError('NOT_FOUND', 'Card not found');
    const owners = await prisma.userCard.count({ where: { cardId: id } });
    if (owners > 0) throw new ApiError('CONFLICT', 'Card has owners — deactivate it instead', { owners });
    const dependants = await prisma.card.count({
      where: { conditionType: 'card', conditionValue: { startsWith: `${id}:` } },
    });
    if (dependants > 0) throw new ApiError('CONFLICT', 'Other cards require this card', { dependants });
    await prisma.card.delete({ where: { id } });
    invalidateCatalog();
    request.log.warn({ admin: request.tg?.user.id, cardId: id }, 'admin: card deleted');
    return { ok: true };
  });
}
