import type { PlayerState } from './api.js';
import type { Locale } from './format.js';

/** Редкость предметов коллекции: от простого к уникальному оформлению. */
export const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;
export type Rarity = (typeof RARITIES)[number];

/** skin — облик кота; effect — эффект тапа (раздел «Косметика»). */
export type CosmeticKind = 'skin' | 'effect';

export type CosmeticPrice = { currency: 'coins' | 'stars'; amount: number } | null;

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  rarity: Rarity;
  /** с какого уровня игрока можно получить (1 — сразу) */
  unlockLevel: number;
  /** null — бесплатно: есть у всех сразу или (с unlockLeague) выдаётся за лигу */
  price: CosmeticPrice;
  /** выдаётся бесплатно, когда игрок доходит до этой лиги (номер лиги: 1 — вторая) */
  unlockLeague?: number;
  name: Record<Locale, string>;
  desc: Record<Locale, string>;
}

export const DEFAULT_SKIN_ID = 'cyber_samurai';
export const DEFAULT_EFFECT_ID = 'coins';

/**
 * Скины прошлой коллекции (перекраски одного кота) → персонажи новой коллекции той же ценности.
 * Нужно миграции базы и старым покупкам за Stars (выдача по неоплаченному счёту, возврат).
 */
export const LEGACY_SKINS: Readonly<Record<string, string>> = {
  black_crown: 'neon_punk',
  pink_angel: 'desert_nomad',
  cyber: 'sakura_blossom',
  crypto_king: 'astro_cat',
  samurai: 'mecha',
  neon_tokyo: 'crystal_prince',
  shadow: 'forest_spirit',
  galaxy: 'ocean_guardian',
  golden_boss: 'stealth_assassin',
  hacker: 'dark_reaper',
  diamond: 'angel_guardian',
  queen: 'shadow_drifter',
  legendary_crown: 'galaxy_emperor',
};

/** id предмета с учётом переименований прошлой коллекции. */
export function resolveCosmeticId(id: string): string {
  return LEGACY_SKINS[id] ?? id;
}

const skin = (
  id: string,
  rarity: Rarity,
  unlockLevel: number,
  price: CosmeticPrice,
  name: [string, string],
  desc: [string, string],
): CosmeticDef => ({
  id,
  kind: 'skin',
  rarity,
  unlockLevel,
  price,
  name: { ru: name[0], en: name[1] },
  desc: { ru: desc[0], en: desc[1] },
});
const effect = (
  id: string,
  rarity: Rarity,
  unlockLevel: number,
  price: CosmeticPrice,
  name: [string, string],
  desc: [string, string],
): CosmeticDef => ({ ...skin(id, rarity, unlockLevel, price, name, desc), kind: 'effect' });
const coins = (amount: number): CosmeticPrice => ({ currency: 'coins', amount });
const stars = (amount: number): CosmeticPrice => ({ currency: 'stars', amount });

/**
 * Каталог коллекции. Скины — разные персонажи (свой костюм, силуэт, сцена и анимация; оформление —
 * frontend/src/game/skins.ts). Редкость — только внешний вид: на доход, тапы и награды скины не влияют.
 * Скины сейчас бесплатные у всех (остальные персонажи переделываются и вернутся позже). Скин можно сделать
 * наградой за лигу ({ ...skin(…), unlockLeague }) или продавать за Telegram Stars (price: stars(…) и товар
 * skin_<id> в shared/src/shop.ts) — магазин, оплата и коллекция это уже поддерживают.
 * Эффекты тапа: открываются с уровнем и покупаются за монеты, премиальный — за Stars.
 * Цены, лиги, уровни и тексты меняются здесь — сервер и клиент берут их отсюда.
 */
export const COSMETICS: readonly CosmeticDef[] = [
  skin(
    'cyber_samurai',
    'LEGENDARY',
    1,
    null,
    ['Кибер-Самурай', 'Cyber Samurai'],
    [
      'Красная катана, кибер-маска и броня. Красная луна, тории и лепестки сакуры.',
      'A red katana, a cyber mask and armour. A red moon, torii gates and sakura petals.',
    ],
  ),
  skin(
    'galaxy_emperor',
    'MYTHIC',
    1,
    null,
    ['Галактический Император', 'Galaxy Emperor'],
    [
      'Звёздная мантия, кольца планет и космическая аура. Целая галактика у его лап.',
      'A starry mantle, planetary rings and a cosmic aura. A whole galaxy at his paws.',
    ],
  ),
  skin(
    'shadow_drifter',
    'LEGENDARY',
    1,
    null,
    ['Теневой Бродяга', 'Shadow Drifter'],
    [
      'Кепка, плащ и фиолетовые тени, что тянутся следом. Ночной мегаполис в огнях.',
      'A cap, a cloak and violet shadows trailing behind. A night megacity in lights.',
    ],
  ),
  effect(
    'coins',
    'COMMON',
    1,
    null,
    ['Монетки', 'Coins'],
    ['Классика: из-под лапы летят монетки.', 'The classic: coins fly from under the paw.'],
  ),
  effect(
    'hearts',
    'RARE',
    2,
    coins(5_000),
    ['Сердечки', 'Hearts'],
    ['Каждый тап — немного любви.', 'Every tap is a little bit of love.'],
  ),
  effect(
    'stars',
    'RARE',
    6,
    coins(150_000),
    ['Звёздочки', 'Stars'],
    ['Искры звёзд под пальцем.', 'Starry sparks under your finger.'],
  ),
  effect(
    'sakura',
    'EPIC',
    10,
    coins(800_000),
    ['Сакура', 'Sakura'],
    ['Лепестки сакуры кружатся от каждого тапа.', 'Sakura petals swirl with every tap.'],
  ),
  effect(
    'lightning',
    'EPIC',
    14,
    coins(5_000_000),
    ['Молнии', 'Lightning'],
    ['Разряд энергии — тапы как удар тока.', 'An energy discharge — taps that hit like lightning.'],
  ),
  effect(
    'matrix',
    'LEGENDARY',
    1,
    stars(99),
    ['Матрица', 'Matrix'],
    ['Зелёные символы кода сыплются из каждого тапа.', 'Green code symbols rain from every tap.'],
  ),
];

export function cosmeticById(id: string): CosmeticDef | undefined {
  return COSMETICS.find((c) => c.id === id);
}

/** Надетый предмет, который клиент сможет показать: неизвестный (удалённый) — стартовый. */
export function knownEquipped(skin: string, effect: string): { skin: string; effect: string } {
  const s = cosmeticById(skin);
  const e = cosmeticById(effect);
  return {
    skin: s?.kind === 'skin' ? s.id : DEFAULT_SKIN_ID,
    effect: e?.kind === 'effect' ? e.id : DEFAULT_EFFECT_ID,
  };
}

/** Бесплатный предмет без условий — есть у всех с самого начала. */
export function isFreeCosmetic(item: CosmeticDef): boolean {
  return item.price === null && item.unlockLeague === undefined && item.unlockLevel <= 1;
}

/**
 * Предметы, которые есть у игрока без покупки: бесплатные (у всех) и награды за уже достигнутые лиги.
 * Порядок — как в каталоге.
 */
export function progressCosmetics(leagueLevel: number): string[] {
  return COSMETICS.filter(
    (c) => isFreeCosmetic(c) || (c.unlockLeague !== undefined && leagueLevel >= c.unlockLeague),
  ).map((c) => c.id);
}

/** Скины-награды, которые выдаёт переход в эту лигу (обычно один). */
export function leagueRewardSkins(league: number): CosmeticDef[] {
  return COSMETICS.filter((c) => c.unlockLeague === league);
}

export interface CollectionResponse {
  /** купленные и стартовые предметы */
  owned: string[];
  equipped: { skin: string; effect: string };
}

export interface CollectionActionResponse extends CollectionResponse {
  state: PlayerState;
}
