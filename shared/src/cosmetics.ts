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
  /** null — бесплатно (стартовый предмет) */
  price: CosmeticPrice;
  name: Record<Locale, string>;
  desc: Record<Locale, string>;
}

export const DEFAULT_SKIN_ID = 'black_crown';
export const DEFAULT_EFFECT_ID = 'coins';

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
 * Каталог коллекции. Скины уровней покупаются за монеты после достижения уровня, премиальные — за
 * Telegram Stars. Цены, уровни и тексты меняются здесь — сервер и клиент берут их отсюда.
 */
export const COSMETICS: readonly CosmeticDef[] = [
  skin(
    'black_crown',
    'COMMON',
    1,
    null,
    ['Чёрный Король', 'Black Crown Cat'],
    [
      'Стритвир, наушники с короной и синий неон. С него всё началось.',
      'Streetwear, crown headphones and blue neon. Where it all began.',
    ],
  ),
  skin(
    'pink_angel',
    'RARE',
    3,
    coins(10_000),
    ['Розовый Ангел', 'Pink Angel Cat'],
    [
      'Пастельно-розовый неон и сердечки вокруг. Милый — но за свой баланс порвёт.',
      'Pastel pink neon and hearts around. Cute — until you touch the balance.',
    ],
  ),
  skin(
    'cyber',
    'RARE',
    5,
    coins(75_000),
    ['Кибер-кот', 'Cyber Cat'],
    [
      'Бирюзовый электрический неон на всём костюме и взгляд из 2077 года.',
      'Turquoise electric neon all over the outfit and a stare from 2077.',
    ],
  ),
  skin(
    'crypto_king',
    'EPIC',
    8,
    coins(400_000),
    ['Крипто-Король', 'Crypto King Cat'],
    [
      'Оранжевый неон цвета биткоина, золотые логотипы и монеты вокруг.',
      'Bitcoin-orange neon, golden logos and coins all around.',
    ],
  ),
  skin(
    'samurai',
    'EPIC',
    10,
    coins(1_000_000),
    ['Кот-самурай', 'Samurai Cat'],
    [
      'Алый неон и лепестки сакуры. Путь холдера — путь воина.',
      'Crimson neon and sakura petals. The holder’s way is the warrior’s way.',
    ],
  ),
  skin(
    'neon_tokyo',
    'EPIC',
    12,
    coins(2_000_000),
    ['Неоновый Токио', 'Neon Tokyo Cat'],
    [
      'Пурпурно-розовые огни ночного Токио и ноты в воздухе.',
      'The magenta-pink lights of Tokyo at night and music in the air.',
    ],
  ),
  skin(
    'shadow',
    'LEGENDARY',
    15,
    coins(4_000_000),
    ['Тень', 'Shadow Cat'],
    [
      'Почти чёрный: приглушённый фиолетовый свет, тёмные логотипы и дымка вокруг.',
      'Almost black: dim violet light, dark logos and smoke around.',
    ],
  ),
  skin(
    'galaxy',
    'LEGENDARY',
    20,
    coins(10_000_000),
    ['Галактический кот', 'Galaxy Cat'],
    [
      'Индиго и фиолет переливаются снизу вверх, вокруг — звёзды.',
      'Indigo flowing into violet from boots to ears, with stars around.',
    ],
  ),
  skin(
    'golden_boss',
    'MYTHIC',
    25,
    coins(25_000_000),
    ['Золотой Босс', 'Golden Boss Cat'],
    [
      'Золотой неон, золотые логотипы и подошвы. Здесь главный — он.',
      'Gold neon, golden logos and soles. This is the boss.',
    ],
  ),
  skin(
    'hacker',
    'MYTHIC',
    30,
    coins(50_000_000),
    ['Кот-хакер', 'Hacker Cat'],
    [
      'Зелёный неон терминала и бегущий код вокруг. Root-доступ к рынку.',
      'Terminal-green neon and running code around. Root access to the market.',
    ],
  ),
  skin(
    'diamond',
    'EPIC',
    1,
    stars(149),
    ['Бриллиантовый кот', 'Diamond Cat'],
    ['Ледяной бело-голубой неон и бриллиантовые искры.', 'Icy white-blue neon and diamond sparkles.'],
  ),
  skin(
    'queen',
    'LEGENDARY',
    1,
    stars(249),
    ['Королева', 'Queen Cat'],
    [
      'Розово-алый неон, золотые короны на одежде, сердечки и особая анимация.',
      'Rose-red neon, golden crowns on the outfit, hearts and a special animation.',
    ],
  ),
  skin(
    'legendary_crown',
    'LEGENDARY',
    1,
    stars(399),
    ['Легендарная Корона', 'Legendary Crown Cat'],
    [
      'Неон переливается от синего к розовому, премиальная аура и двойная волна на каждый тап.',
      'Neon flowing from blue to pink, a premium aura and a double wave on every tap.',
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
    coins(3_000_000),
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

/** Стартовые предметы есть у всех. */
export function isDefaultCosmetic(id: string): boolean {
  return id === DEFAULT_SKIN_ID || id === DEFAULT_EFFECT_ID;
}

export interface CollectionResponse {
  /** купленные и стартовые предметы */
  owned: string[];
  equipped: { skin: string; effect: string };
}

export interface CollectionActionResponse extends CollectionResponse {
  state: PlayerState;
}
