import { randomInt } from 'node:crypto';
import type { DailyCipher, DailyCombo, User } from '@prisma/client';
import type { CipherState, ComboCard, ComboState, ComboUpdate } from '@meowgul/shared';
import { CIPHER_WORDS } from '../game/config/ciphers.js';
import { COMBO_MAX_BASE_COST, cipherReward, comboReward } from '../game/config/rewards.js';
import { dayKey } from '../game/dayKey.js';
import { prisma } from '../lib/db.js';
import { getCatalog, type CatalogCard } from './cards.js';
import { applyBalanceChanges } from './ledger.js';
import type { Tx } from './userLock.js';

type Db = Tx | typeof prisma;

export const COMBO_SIZE = 3;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Карточки, из которых можно составить комбо: в продаже, не лимитированные, доступные без друзей и лиг. */
export function comboCandidates(catalog: readonly CatalogCard[]): CatalogCard[] {
  return catalog.filter(
    (c) =>
      c.isActive &&
      !c.isLimited &&
      c.baseCost <= COMBO_MAX_BASE_COST &&
      (c.condition === null || c.condition.type === 'card'),
  );
}

/** Случайное комбо: по одной карточке из трёх разных категорий. */
export function pickCombo(catalog: readonly CatalogCard[]): string[] {
  const candidates = comboCandidates(catalog);
  const byCategory = new Map<string, CatalogCard[]>();
  for (const c of candidates) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  const categories = shuffle([...byCategory.keys()]);
  const picked = categories.slice(0, COMBO_SIZE).map((cat) => {
    const list = byCategory.get(cat)!;
    return list[randomInt(list.length)]!.id;
  });
  // категорий меньше трёх (каталог урезан в админке) — добираем из оставшихся карточек
  const rest = shuffle(candidates.filter((c) => !picked.includes(c.id)));
  while (picked.length < COMBO_SIZE && rest.length) picked.push(rest.pop()!.id);
  return picked;
}

/** Комбо игрового дня: заданное админом или выбранное случайно при первом обращении. */
export async function comboForDay(key: string, db: Db = prisma): Promise<DailyCombo> {
  const existing = await db.dailyCombo.findUnique({ where: { dayKey: key } });
  if (existing) return existing;
  const cardIds = pickCombo(await getCatalog());
  await db.dailyCombo.createMany({ data: [{ dayKey: key, cardIds, source: 'auto' }], skipDuplicates: true });
  return db.dailyCombo.findUniqueOrThrow({ where: { dayKey: key } });
}

/** Шифр игрового дня: заданный админом или случайное слово из списка. */
export async function cipherForDay(key: string, db: Db = prisma): Promise<DailyCipher> {
  const existing = await db.dailyCipher.findUnique({ where: { dayKey: key } });
  if (existing) return existing;
  const word = CIPHER_WORDS[randomInt(CIPHER_WORDS.length)]!;
  await db.dailyCipher.createMany({
    data: [{ dayKey: key, word: word.word, hintRu: word.hintRu, hintEn: word.hintEn, source: 'auto' }],
    skipDuplicates: true,
  });
  return db.dailyCipher.findUniqueOrThrow({ where: { dayKey: key } });
}

async function comboCards(ids: readonly string[]): Promise<ComboCard[]> {
  const catalog = await getCatalog();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const c = byId.get(id);
    return c ? [{ id: c.id, name: { ru: c.nameRu, en: c.nameEn }, icon: c.icon, category: c.category }] : [];
  });
}

export async function comboState(
  combo: DailyCombo,
  progress: { foundCardIds: string[]; rewarded: boolean } | null,
  profitPerHour: number,
): Promise<ComboState> {
  const found = (progress?.foundCardIds ?? []).filter((id) => combo.cardIds.includes(id));
  const cards = await comboCards(found);
  return {
    dayKey: combo.dayKey,
    slots: Array.from({ length: COMBO_SIZE }, (_, i) => cards[i] ?? null),
    rewarded: progress?.rewarded ?? false,
    reward: comboReward(profitPerHour),
  };
}

export function cipherState(cipher: DailyCipher, solved: boolean, profitPerHour: number): CipherState {
  return {
    dayKey: cipher.dayKey,
    length: cipher.word.length,
    hint: { ru: cipher.hintRu, en: cipher.hintEn },
    solved,
    reward: cipherReward(profitPerHour),
  };
}

/**
 * Карточка улучшена: если она из сегодняшнего комбо — отмечаем; собраны все три — награда.
 * Вызывается в транзакции покупки (под блокировкой игрока).
 */
export async function registerComboCard(
  tx: Tx,
  user: User,
  cardId: string,
  now: Date,
): Promise<{ user: User; update: ComboUpdate | null }> {
  const key = dayKey(now);
  const combo = await comboForDay(key, tx);
  if (!combo.cardIds.includes(cardId)) return { user, update: null };
  const progress = await tx.userComboProgress.upsert({
    where: { userId_dayKey: { userId: user.id, dayKey: key } },
    create: { userId: user.id, dayKey: key, foundCardIds: [] },
    update: {},
  });
  if (progress.foundCardIds.includes(cardId)) return { user, update: null };
  const found = [...progress.foundCardIds, cardId];
  const complete = combo.cardIds.every((id) => found.includes(id));
  let updatedUser = user;
  let reward = 0;
  if (complete && !progress.rewarded) {
    reward = comboReward(Number(user.profitPerHour));
    updatedUser = await applyBalanceChanges(
      tx,
      user,
      [{ type: 'combo_reward', amount: reward, meta: { dayKey: key, cardIds: combo.cardIds } }],
      {},
      now,
    );
  }
  const saved = await tx.userComboProgress.update({
    where: { userId_dayKey: { userId: user.id, dayKey: key } },
    data: { foundCardIds: found, rewarded: progress.rewarded || reward > 0 },
  });
  return {
    user: updatedUser,
    update: { combo: await comboState(combo, saved, Number(updatedUser.profitPerHour)), reward },
  };
}
