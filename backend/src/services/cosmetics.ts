import {
  COSMETICS,
  cosmeticById,
  DEFAULT_EFFECT_ID,
  DEFAULT_SKIN_ID,
  isDefaultCosmetic,
  knownEquipped,
  playerLevel,
  resolveCosmeticId,
  type CollectionResponse,
  type CosmeticDef,
} from '@meowgul/shared';
import type { User } from '@prisma/client';
import type { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';
import { toCoins } from '../lib/money.js';
import { applyBalanceChanges } from './ledger.js';
import { devModeOn } from './state.js';
import type { Tx } from './userLock.js';

type Db = Tx | typeof prisma;

/**
 * Предметы игрока: стартовые + купленные (только существующие в каталоге). В режиме разработчика — весь
 * каталог (для проверки; в базе ничего не выдаётся).
 */
export async function ownedCosmetics(
  db: Db,
  user: Pick<User, 'id' | 'telegramId' | 'settings'>,
): Promise<string[]> {
  if (devModeOn(user)) return COSMETICS.map((c) => c.id);
  const rows = await db.userCosmetic.findMany({ where: { userId: user.id }, select: { cosmeticId: true } });
  return [
    DEFAULT_SKIN_ID,
    DEFAULT_EFFECT_ID,
    ...rows.map((r) => r.cosmeticId).filter((id) => cosmeticById(id)),
  ];
}

export function collectionOf(
  user: Pick<User, 'equippedSkinId' | 'equippedEffectId'>,
  owned: string[],
): CollectionResponse {
  return { owned, equipped: knownEquipped(user.equippedSkinId, user.equippedEffectId) };
}

export function requireCosmetic(id: string): CosmeticDef {
  const item = cosmeticById(id);
  if (!item) throw new ApiError('NOT_FOUND', 'Unknown item');
  return item;
}

/** Уровень игрока для проверок (по монетам, заработанным за всё время). */
export function levelOf(user: Pick<User, 'totalEarned'>): number {
  return playerLevel(toCoins(user.totalEarned)).level;
}

/**
 * Покупка за монеты: предмет из каталога, уровень достигнут, ещё не куплен, хватает монет (иначе
 * INSUFFICIENT_FUNDS — ledger не даёт уйти в минус). Купленное сразу надевается. Внутри withUserLock.
 */
export async function buyWithCoins(tx: Tx, user: User, id: string, now: Date): Promise<User> {
  const item = requireCosmetic(id);
  if (!item.price || item.price.currency !== 'coins') throw new ApiError('VALIDATION', 'Not sold for coins');
  if (levelOf(user) < item.unlockLevel) {
    throw new ApiError('LOCKED', 'Level is too low', { level: item.unlockLevel });
  }
  if (
    await tx.userCosmetic.findUnique({ where: { userId_cosmeticId: { userId: user.id, cosmeticId: id } } })
  ) {
    throw new ApiError('CONFLICT', 'Already owned');
  }
  const updated = await applyBalanceChanges(
    tx,
    user,
    [{ type: 'cosmetic_purchase', amount: -item.price.amount, meta: { cosmeticId: id } }],
    equipData(item),
    now,
  );
  await tx.userCosmetic.create({ data: { userId: user.id, cosmeticId: id, source: 'coins' } });
  return updated;
}

/**
 * Выдать предмет (оплата Stars, админ) и надеть его. Повторная выдача ничего не меняет. Счёт,
 * выставленный за скин прошлой коллекции, выдаёт его замену из новой.
 */
export async function grantCosmetic(
  tx: Tx,
  user: User,
  grantedId: string,
  source: 'stars' | 'admin',
): Promise<User> {
  const id = resolveCosmeticId(grantedId);
  const item = requireCosmetic(id);
  await tx.userCosmetic.upsert({
    where: { userId_cosmeticId: { userId: user.id, cosmeticId: id } },
    create: { userId: user.id, cosmeticId: id, source },
    update: {},
  });
  return tx.user.update({ where: { id: user.id }, data: equipData(item) });
}

/** Забрать предмет (возврат оплаты): если он был надет — вернуть стартовый. */
export async function revokeCosmetic(tx: Tx, user: User, revokedId: string): Promise<User> {
  const id = resolveCosmeticId(revokedId);
  await tx.userCosmetic.deleteMany({ where: { userId: user.id, cosmeticId: id } });
  return tx.user.update({
    where: { id: user.id },
    data: {
      ...(user.equippedSkinId === id ? { equippedSkinId: DEFAULT_SKIN_ID } : {}),
      ...(user.equippedEffectId === id ? { equippedEffectId: DEFAULT_EFFECT_ID } : {}),
    },
  });
}

/** Надеть свой предмет (скин или эффект тапа). */
export async function equipCosmetic(tx: Tx, user: User, id: string): Promise<User> {
  const item = requireCosmetic(id);
  const owned =
    isDefaultCosmetic(id) ||
    devModeOn(user) ||
    (await tx.userCosmetic.findUnique({ where: { userId_cosmeticId: { userId: user.id, cosmeticId: id } } }));
  if (!owned) throw new ApiError('LOCKED', 'Item is not owned');
  return tx.user.update({ where: { id: user.id }, data: equipData(item) });
}

function equipData(item: CosmeticDef) {
  return item.kind === 'skin' ? { equippedSkinId: item.id } : { equippedEffectId: item.id };
}
