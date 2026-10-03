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

export const DEFAULT_SKIN_ID = 'neon_punk';
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
 * Каталог коллекции. Скины уровней покупаются за монеты после достижения уровня, премиальные — за
 * Telegram Stars. Цены, уровни и тексты меняются здесь — сервер и клиент берут их отсюда.
 */
/**
 * Каталог коллекции. Скины — разные персонажи (свой костюм, силуэт, сцена и анимация; оформление —
 * frontend/src/game/skins.ts). Редкость — только внешний вид: на доход, тапы и награды скины не влияют.
 * Скины уровней покупаются за монеты после достижения уровня, премиальные — за Telegram Stars.
 * Цены, уровни и тексты меняются здесь — сервер и клиент берут их отсюда.
 */
export const COSMETICS: readonly CosmeticDef[] = [
  skin(
    'neon_punk',
    'EPIC',
    1,
    null,
    ['Неоновый Панк', 'Neon Punk'],
    [
      'Кибер-худи, наушники и синий ирокез. Ночной город светится вокруг — с него всё начинается.',
      'Cyber hoodie, headphones and a blue mohawk. The night city glows around — where it all begins.',
    ],
  ),
  skin(
    'desert_nomad',
    'EPIC',
    3,
    coins(10_000),
    ['Пустынный Странник', 'Desert Nomad'],
    [
      'Очки-гогглы, шарф от песка и походное снаряжение. Ветер гонит дюны к старой крепости.',
      'Goggles, a sand scarf and travel gear. The wind drives the dunes towards an old fortress.',
    ],
  ),
  skin(
    'sakura_blossom',
    'EPIC',
    5,
    coins(75_000),
    ['Цветок Сакуры', 'Sakura Blossom'],
    [
      'Розовое кимоно, нимб и цветы в волосах. Вокруг — сад и кружащиеся лепестки.',
      'A pink kimono, a halo and flowers in the hair. A garden and swirling petals all around.',
    ],
  ),
  skin(
    'astro_cat',
    'EPIC',
    8,
    coins(400_000),
    ['Астрокот', 'Astro Cat'],
    [
      'Скафандр, шлем с антенной и Земля за спиной. Невесомость ему к лицу.',
      'A spacesuit, a helmet with an antenna and Earth behind. Zero gravity suits him.',
    ],
  ),
  skin(
    'mecha',
    'EPIC',
    10,
    coins(1_000_000),
    ['Меха', 'Mecha'],
    [
      'Боевая броня с голубыми реакторами и крыльями-лезвиями. Город будущего в огнях.',
      'Battle armour with blue reactors and blade wings. A future city in lights.',
    ],
  ),
  skin(
    'crystal_prince',
    'EPIC',
    12,
    coins(2_500_000),
    ['Кристальный Принц', 'Crystal Prince'],
    [
      'Корона из кристаллов и мантия с аметистами. Кристаллический лес мерцает фиолетовым.',
      'A crown of crystals and an amethyst mantle. The crystal forest shimmers violet.',
    ],
  ),
  skin(
    'forest_spirit',
    'LEGENDARY',
    14,
    coins(8_000_000),
    ['Лесной Дух', 'Forest Spirit'],
    [
      'Рога из веток, мох и листья на плаще. Светлячки и лучи сквозь листву древнего леса.',
      'Antlers of branches, moss and leaves on the cloak. Fireflies and sunbeams in an ancient forest.',
    ],
  ),
  skin(
    'ocean_guardian',
    'LEGENDARY',
    16,
    coins(20_000_000),
    ['Страж Океана', 'Ocean Guardian'],
    [
      'Трезубец, чешуйчатая броня и шерсть цвета волны. Пузырьки и свет из глубины.',
      'A trident, scale armour and fur the colour of the waves. Bubbles and light from the deep.',
    ],
  ),
  skin(
    'inferno',
    'LEGENDARY',
    19,
    coins(60_000_000),
    ['Инферно', 'Inferno'],
    [
      'Огненный хвост, броня в раскалённых трещинах и искры вокруг. Всё вокруг горит.',
      'A flaming tail, armour with glowing cracks and sparks around. Everything is on fire.',
    ],
  ),
  skin(
    'toxic',
    'LEGENDARY',
    22,
    coins(150_000_000),
    ['Токсик', 'Toxic'],
    [
      'Противогаз, кислотно-зелёные пятна и пар. Лаборатория, где что-то пошло не так.',
      'A gas mask, acid-green stains and steam. A lab where something went wrong.',
    ],
  ),
  skin(
    'stealth_assassin',
    'LEGENDARY',
    25,
    coins(600_000_000),
    ['Тайный Ассасин', 'Stealth Assassin'],
    [
      'Капюшон, маска и клинок с алым отсветом. Ночной храм и падающие лепестки.',
      'A hood, a mask and a blade with a crimson glow. A night temple and falling petals.',
    ],
  ),
  skin(
    'dark_reaper',
    'LEGENDARY',
    28,
    coins(2_000_000_000),
    ['Тёмный Жнец', 'Dark Reaper'],
    [
      'Коса с фиолетовым пламенем и рваный плащ. Луна над старым кладбищем.',
      'A scythe with violet flame and a tattered cloak. The moon over an old graveyard.',
    ],
  ),
  skin(
    'arctic_king',
    'MYTHIC',
    31,
    coins(6_000_000_000),
    ['Арктический Король', 'Arctic King'],
    [
      'Ледяная корона, меховая мантия и посох из льда. Снег над замком на вершине.',
      'An ice crown, a fur mantle and a staff of ice. Snow over a castle on the summit.',
    ],
  ),
  skin(
    'vampire_lord',
    'MYTHIC',
    35,
    coins(20_000_000_000),
    ['Лорд Вампиров', 'Vampire Lord'],
    [
      'Алые глаза, крылья и плащ с высоким воротником. Кровавая луна над замком.',
      'Crimson eyes, wings and a high-collared cloak. A blood moon over the castle.',
    ],
  ),
  skin(
    'lunar_witch',
    'MYTHIC',
    40,
    coins(60_000_000_000),
    ['Лунная Ведьма', 'Lunar Witch'],
    [
      'Широкополая шляпа, посох с лунным камнем и фиолетовые чары. Полная луна над шпилями.',
      'A wide-brimmed hat, a moonstone staff and violet spells. A full moon over the spires.',
    ],
  ),
  skin(
    'royal_emperor',
    'MYTHIC',
    45,
    coins(200_000_000_000),
    ['Император', 'Royal Emperor'],
    [
      'Золотая корона, алая мантия и золотые драконы за троном. Здесь главный — он.',
      'A golden crown, a crimson robe and golden dragons behind the throne. This is the boss.',
    ],
  ),
  skin(
    'angel_guardian',
    'EPIC',
    1,
    stars(149),
    ['Ангел-Хранитель', 'Angel Guardian'],
    [
      'Белые крылья, нимб и сияющий клинок. Облака и мягкий свет небес.',
      'White wings, a halo and a shining blade. Clouds and the soft light of the heavens.',
    ],
  ),
  skin(
    'shadow_drifter',
    'LEGENDARY',
    1,
    stars(249),
    ['Теневой Бродяга', 'Shadow Drifter'],
    [
      'Кепка, плащ и фиолетовые тени, что тянутся следом. Ночной мегаполис в огнях.',
      'A cap, a cloak and violet shadows trailing behind. A night megacity in lights.',
    ],
  ),
  skin(
    'cyber_samurai',
    'LEGENDARY',
    1,
    stars(299),
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
    stars(399),
    ['Галактический Император', 'Galaxy Emperor'],
    [
      'Звёздная мантия, кольца планет и космическая аура. Целая галактика у его лап.',
      'A starry mantle, planetary rings and a cosmic aura. A whole galaxy at his paws.',
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
