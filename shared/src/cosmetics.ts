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
      'С него всё началось: чёрный кот с короной и холодным взглядом трейдера.',
      'Where it all began: a black cat with a crown and a trader’s cold stare.',
    ],
  ),
  skin(
    'pink_angel',
    'RARE',
    3,
    coins(10_000),
    ['Розовый Ангел', 'Pink Angel Cat'],
    [
      'Нимб, крылышки и розовый неон. Милый — но за свой баланс порвёт.',
      'Halo, tiny wings and pink neon. Cute — until you touch the balance.',
    ],
  ),
  skin(
    'cyber',
    'RARE',
    5,
    coins(75_000),
    ['Кибер-кот', 'Cyber Cat'],
    [
      'Электрический синий, светодиоды и взгляд из 2077 года.',
      'Electric blue, LEDs and a stare straight from 2077.',
    ],
  ),
  skin(
    'crypto_king',
    'EPIC',
    8,
    coins(400_000),
    ['Крипто-Король', 'Crypto King Cat'],
    [
      'Золотая корона, золотая аура и ни одной продажи на дне.',
      'Gold crown, gold aura and not a single sale at the bottom.',
    ],
  ),
  skin(
    'samurai',
    'EPIC',
    10,
    coins(1_000_000),
    ['Кот-самурай', 'Samurai Cat'],
    [
      'Чёрно-красные доспехи и катана. Путь холдера — путь воина.',
      'Black and red armour and a katana. The holder’s way is the warrior’s way.',
    ],
  ),
  skin(
    'neon_tokyo',
    'EPIC',
    12,
    coins(2_000_000),
    ['Неоновый Токио', 'Neon Tokyo Cat'],
    [
      'Наушники, стритвир и розово-фиолетовые огни ночного Токио.',
      'Headphones, streetwear and the pink-violet lights of Tokyo at night.',
    ],
  ),
  skin(
    'shadow',
    'LEGENDARY',
    15,
    coins(4_000_000),
    ['Тень', 'Shadow Cat'],
    [
      'Почти невидим в темноте — выдают только светящиеся глаза.',
      'Nearly invisible in the dark — only the glowing eyes give it away.',
    ],
  ),
  skin(
    'galaxy',
    'LEGENDARY',
    20,
    coins(10_000_000),
    ['Галактический кот', 'Galaxy Cat'],
    [
      'Звёзды, туманности и космический взгляд сквозь графики.',
      'Stars, nebulae and a cosmic gaze through the charts.',
    ],
  ),
  skin(
    'golden_boss',
    'MYTHIC',
    25,
    coins(25_000_000),
    ['Золотой Босс', 'Golden Boss Cat'],
    [
      'Огромная корона и золотое сияние. Здесь главный — он.',
      'A massive crown and a golden glow. This is the boss.',
    ],
  ),
  skin(
    'hacker',
    'MYTHIC',
    30,
    coins(50_000_000),
    ['Кот-хакер', 'Hacker Cat'],
    [
      'Зелёный терминал, бегущий код и root-доступ к рынку.',
      'A green terminal, running code and root access to the market.',
    ],
  ),
  skin(
    'diamond',
    'EPIC',
    1,
    stars(149),
    ['Бриллиантовый кот', 'Diamond Cat'],
    [
      'Чёрное и белое, бриллианты и сине-фиолетовое сияние.',
      'Black and white, diamonds and a blue-violet glow.',
    ],
  ),
  skin(
    'queen',
    'LEGENDARY',
    1,
    stars(249),
    ['Королева', 'Queen Cat'],
    [
      'Розово-чёрная королева: большая корона, сердечки и особая анимация.',
      'The pink-and-black queen: a big crown, hearts and a special animation.',
    ],
  ),
  skin(
    'legendary_crown',
    'LEGENDARY',
    1,
    stars(399),
    ['Легендарная Корона', 'Legendary Crown Cat'],
    [
      'Тактический чёрный, неоновые акценты, корона, премиальная аура и свои реакции на тап.',
      'Tactical black, neon accents, a crown, a premium aura and its own tap reactions.',
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
