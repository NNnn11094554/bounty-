import type { Card, Prisma, User, UserCard } from '@prisma/client';
import type { CardLock, CardView } from '@meowgul/shared';
import { env } from '../env.js';
import {
  CARDS,
  LIMITED_ROTATION,
  cardLevelCost,
  cardLevelProfit,
  cardTotalProfit,
  type CardCondition,
  type CardConfig,
} from '../game/config/cards.js';
import { LEAGUES } from '../game/config/leagues.js';
import { prisma } from '../lib/db.js';
import type { Tx } from './userLock.js';

/** Карточка каталога: экономика из БД (правится в админке), числа — обычные number. */
export interface CatalogCard extends CardConfig {
  availableFrom: Date | null;
  availableUntil: Date | null;
  isActive: boolean;
}

const CACHE_TTL_MS = 30_000;
let cache: { at: number; cards: CatalogCard[]; byId: Map<string, CatalogCard> } | null = null;

export function conditionToRow(c: CardCondition | null): {
  conditionType: string | null;
  conditionValue: string | null;
} {
  if (!c) return { conditionType: null, conditionValue: null };
  switch (c.type) {
    case 'card':
      return { conditionType: 'card', conditionValue: `${c.cardId}:${c.level}` };
    case 'friends':
      return { conditionType: 'friends', conditionValue: String(c.count) };
    case 'league':
      return { conditionType: 'league', conditionValue: String(c.level) };
    case 'task':
      return { conditionType: 'task', conditionValue: c.taskId };
  }
}

export function conditionFromRow(type: string | null, value: string | null): CardCondition | null {
  if (!type || value === null) return null;
  if (type === 'card') {
    const [cardId, level] = value.split(':');
    const n = Number(level);
    return cardId && Number.isInteger(n) && n > 0 ? { type: 'card', cardId, level: n } : null;
  }
  const n = Number(value);
  if (type === 'friends') return Number.isInteger(n) && n > 0 ? { type: 'friends', count: n } : null;
  if (type === 'league') return Number.isInteger(n) && n > 0 ? { type: 'league', level: n } : null;
  if (type === 'task') return value ? { type: 'task', taskId: value } : null;
  return null;
}

export function cardConfigToRow(c: CardConfig): Prisma.CardCreateManyInput {
  return {
    id: c.id,
    category: c.category,
    nameRu: c.nameRu,
    nameEn: c.nameEn,
    descRu: c.descRu,
    descEn: c.descEn,
    icon: c.icon,
    baseCost: BigInt(c.baseCost),
    baseProfit: BigInt(c.baseProfit),
    costMultiplier: c.costMultiplier,
    profitMultiplier: c.profitMultiplier,
    maxLevel: c.maxLevel,
    cooldownSec: c.cooldownSec,
    ...conditionToRow(c.condition),
    isLimited: c.isLimited,
    sortOrder: c.sortOrder,
  };
}

export function cardFromRow(row: Card): CatalogCard {
  return {
    id: row.id,
    category: row.category,
    nameRu: row.nameRu,
    nameEn: row.nameEn,
    descRu: row.descRu,
    descEn: row.descEn,
    icon: row.icon,
    baseCost: Number(row.baseCost),
    baseProfit: Number(row.baseProfit),
    costMultiplier: row.costMultiplier.toNumber(),
    profitMultiplier: row.profitMultiplier.toNumber(),
    maxLevel: row.maxLevel,
    cooldownSec: row.cooldownSec,
    condition: conditionFromRow(row.conditionType, row.conditionValue),
    isLimited: row.isLimited,
    sortOrder: row.sortOrder,
    availableFrom: row.availableFrom,
    availableUntil: row.availableUntil,
    isActive: row.isActive,
  };
}

/**
 * Добавить в БД карточки из конфига, которых там ещё нет (при старте сервера).
 * Существующие не трогаются — их правят в админке. force — перезаписать всё из конфига.
 */
export async function seedCards(opts: { force?: boolean } = {}): Promise<number> {
  const rows = CARDS.map(cardConfigToRow);
  let changed: number;
  if (opts.force) {
    await prisma.$transaction(
      rows.map((row) => prisma.card.upsert({ where: { id: row.id }, create: row, update: row })),
    );
    changed = rows.length;
  } else {
    changed = (await prisma.card.createMany({ data: rows, skipDuplicates: true })).count;
  }
  invalidateCatalog();
  return changed;
}

export function invalidateCatalog(): void {
  cache = null;
}

/** Каталог карточек (кэш на 30 секунд на процесс; админка сбрасывает его при изменениях). */
export async function getCatalog(): Promise<CatalogCard[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.cards;
  const rows = await prisma.card.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] });
  const cards = rows.map(cardFromRow);
  cache = { at: Date.now(), cards, byId: new Map(cards.map((c) => [c.id, c])) };
  return cards;
}

export async function getCatalogCard(id: string): Promise<CatalogCard | undefined> {
  await getCatalog();
  return cache?.byId.get(id);
}

function rotationEpoch(): number {
  const [y, m, d] = LIMITED_ROTATION.epoch.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, env.DAILY_RESET_UTC_HOUR);
}

export interface LimitedWindow {
  active: boolean;
  /** конец текущего окна */
  until: Date | null;
  /** начало следующего окна, если сейчас карточка недоступна */
  nextFrom: Date | null;
}

/**
 * Окно продажи лимитированной карточки на момент now.
 * Если админ задал availableFrom/availableUntil — они; иначе — автоматическая ротация.
 */
export function limitedWindow(card: CatalogCard, catalog: readonly CatalogCard[], now: Date): LimitedWindow {
  const t = now.getTime();
  if (card.availableFrom || card.availableUntil) {
    const from = card.availableFrom?.getTime() ?? -Infinity;
    const until = card.availableUntil?.getTime() ?? Infinity;
    const active = from <= t && t < until;
    return {
      active,
      until: card.availableUntil,
      nextFrom: !active && t < from ? card.availableFrom : null,
    };
  }
  const rotating = catalog
    .filter((c) => c.isLimited && c.isActive && !c.availableFrom && !c.availableUntil)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const index = rotating.findIndex((c) => c.id === card.id);
  if (index < 0) return { active: false, until: null, nextFrom: null };
  const slotMs = LIMITED_ROTATION.slotHours * 3600_000;
  const n = rotating.length;
  const perSlot = Math.min(LIMITED_ROTATION.concurrent, n);
  // в слоте s продаются карточки с номерами s·perSlot … s·perSlot+perSlot−1 (по кругу)
  const inSlot = (slot: number) => {
    const offset = (((index - slot * perSlot) % n) + n) % n;
    return offset < perSlot;
  };
  const epoch = rotationEpoch();
  const current = Math.floor((t - epoch) / slotMs);
  let first = current;
  while (!inSlot(first)) first++;
  let last = first;
  while (last - first < n && inSlot(last + 1)) last++;
  const active = first === current;
  return {
    active,
    until: new Date(epoch + (last + 1) * slotMs),
    nextFrom: active ? null : new Date(epoch + first * slotMs),
  };
}

/** Что известно об игроке для проверки условий открытия карточек. */
export interface PlayerProgress {
  levels: Map<string, number>;
  cooldowns: Map<string, Date | null>;
  friends: number;
  tasksDone: Set<string>;
  leagueLevel: number;
}

export async function loadProgress(db: Tx | typeof prisma, user: User): Promise<PlayerProgress> {
  const [cards, friends, tasks] = await Promise.all([
    db.userCard.findMany({ where: { userId: user.id } }),
    db.referral.count({ where: { inviterId: user.id } }),
    db.userTask.findMany({ where: { userId: user.id, status: 'DONE' }, select: { taskId: true } }),
  ]);
  return progressFrom(cards, friends, new Set(tasks.map((t) => t.taskId)), user.leagueLevel);
}

export function progressFrom(
  cards: readonly UserCard[],
  friends: number,
  tasksDone: Set<string>,
  leagueLevel: number,
): PlayerProgress {
  return {
    levels: new Map(cards.map((c) => [c.cardId, c.level])),
    cooldowns: new Map(cards.map((c) => [c.cardId, c.cooldownUntil])),
    friends,
    tasksDone,
    leagueLevel,
  };
}

async function taskTitles(ids: string[]): Promise<Map<string, { ru: string; en: string }>> {
  if (ids.length === 0) return new Map();
  const tasks = await prisma.task.findMany({
    where: { id: { in: ids } },
    select: { id: true, titleRu: true, titleEn: true },
  });
  return new Map(tasks.map((t) => [t.id, { ru: t.titleRu, en: t.titleEn }]));
}

/** Невыполненное условие открытия карточки (null — открыта). Условие проверяется только до первой покупки. */
export function cardLock(
  card: CatalogCard,
  progress: PlayerProgress,
  catalog: ReadonlyMap<string, CatalogCard>,
  titles: ReadonlyMap<string, { ru: string; en: string }> = new Map(),
): CardLock | null {
  const c = card.condition;
  if (!c || (progress.levels.get(card.id) ?? 0) > 0) return null;
  switch (c.type) {
    case 'card': {
      const current = progress.levels.get(c.cardId) ?? 0;
      if (current >= c.level) return null;
      const required = catalog.get(c.cardId);
      return {
        type: 'card',
        cardId: c.cardId,
        level: c.level,
        currentLevel: current,
        name: { ru: required?.nameRu ?? c.cardId, en: required?.nameEn ?? c.cardId },
      };
    }
    case 'friends':
      return progress.friends >= c.count
        ? null
        : { type: 'friends', count: c.count, current: progress.friends };
    case 'task':
      return progress.tasksDone.has(c.taskId)
        ? null
        : { type: 'task', taskId: c.taskId, title: titles.get(c.taskId) ?? null };
    case 'league':
      return progress.leagueLevel >= c.level
        ? null
        : { type: 'league', level: c.level, name: LEAGUES[c.level]?.name ?? String(c.level + 1) };
  }
}

export function cardView(
  card: CatalogCard,
  progress: PlayerProgress,
  catalog: readonly CatalogCard[],
  byId: ReadonlyMap<string, CatalogCard>,
  titles: ReadonlyMap<string, { ru: string; en: string }>,
  now: Date,
): CardView {
  const level = progress.levels.get(card.id) ?? 0;
  const next = level + 1;
  const isMax = level >= card.maxLevel;
  const cooldown = progress.cooldowns.get(card.id) ?? null;
  const window = card.isLimited ? limitedWindow(card, catalog, now) : null;
  return {
    id: card.id,
    category: card.category,
    name: { ru: card.nameRu, en: card.nameEn },
    description: { ru: card.descRu, en: card.descEn },
    icon: card.icon,
    level,
    maxLevel: card.maxLevel,
    profitPerHour: cardTotalProfit(card, level),
    nextProfit: isMax ? null : cardLevelProfit(card, next),
    nextPrice: isMax ? null : cardLevelCost(card, next),
    cooldownUntil: cooldown && cooldown > now ? cooldown.getTime() : null,
    cooldownSec: card.cooldownSec,
    lock: cardLock(card, progress, byId, titles),
    available: card.isActive && (!window || window.active),
    limited: window
      ? { until: window.until?.getTime() ?? null, nextFrom: window.nextFrom?.getTime() ?? null }
      : null,
    sortOrder: card.sortOrder,
  };
}

/**
 * Карточки, которые видит игрок: все активные, кроме лимитированных вне окна продажи,
 * плюс уже купленные (их прибыль продолжает идти, даже если карточку сняли с продажи).
 */
export function visibleCards(
  catalog: readonly CatalogCard[],
  progress: PlayerProgress,
  now: Date,
  only: (card: CatalogCard) => boolean = () => true,
): CatalogCard[] {
  return catalog.filter((card) => {
    if (!only(card)) return false;
    if ((progress.levels.get(card.id) ?? 0) > 0) return true;
    if (!card.isActive) return false;
    return !card.isLimited || limitedWindow(card, catalog, now).active;
  });
}

export async function buildCardViews(
  cards: readonly CatalogCard[],
  progress: PlayerProgress,
  now: Date,
): Promise<CardView[]> {
  const catalog = await getCatalog();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const taskIds = [
    ...new Set(cards.flatMap((c) => (c.condition?.type === 'task' ? [c.condition.taskId] : []))),
  ];
  const titles = await taskTitles(taskIds);
  return cards.map((c) => cardView(c, progress, catalog, byId, titles, now));
}

/** Обработчики улучшения карточки (комбо дня, достижения) — в той же транзакции. */
export type CardUpgradeHook = (
  tx: Tx,
  user: User,
  card: CatalogCard,
  level: number,
  now: Date,
) => Promise<void>;
const upgradeHooks: CardUpgradeHook[] = [];
export function onCardUpgraded(hook: CardUpgradeHook): void {
  upgradeHooks.push(hook);
}
export async function runCardUpgradeHooks(
  tx: Tx,
  user: User,
  card: CatalogCard,
  level: number,
  now: Date,
): Promise<void> {
  for (const hook of upgradeHooks) await hook(tx, user, card, level, now);
}
