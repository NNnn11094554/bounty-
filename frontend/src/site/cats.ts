import type { Rarity } from '@meowgul/shared';
import { pixelRatio } from '../game/skins';
import art from './catArt.json';
import assets from './catAssets.json';

/**
 * Персонажи сайта. Арт — те же исходники и тот же конвейер, что у скинов игры (scripts/skins:
 * compose.py → build.mjs site): персонаж с прозрачным фоном, его мир без персонажа и портрет.
 */
/**
 * Спокойная жизнь персонажа (всё медленно, мелко и в случайные моменты — без циклов «влево-вправо»).
 * Значения — сила каждого движения 0…1; 0 — у этого кота такого движения нет.
 */
export interface IdleProfile {
  /** дыхание корпусом и период вдоха, с */
  breath: number;
  breathPeriod: number;
  /** моргание: в среднем раз в столько секунд */
  blinkEvery: number;
  /** хвост: медленное движение */
  tail: number;
  /** уши: как часто поводит (1 — обычно) */
  ears: number;
  /** голова: поворот и взгляд в сторону */
  head: number;
  /** плечи: редкое спокойное движение */
  shoulders: number;
}

export interface SiteCat {
  id: string;
  name: string;
  /** атмосферный подзаголовок одной строкой */
  subtitle: string;
  rarity: Rarity;
  /** мир персонажа — подпись к атмосфере */
  world: string;
  /** лор: 1–2 предложения */
  story: string;
  /** сила персонажа в лоре (на экономику игры скины не влияют) */
  power: number;
  /** стихия / тип */
  element: string;
  /** основной цвет света, частиц и интерфейса */
  accent: string;
  /** второй цвет: блики, край проявления */
  accent2: string;
  /** цвет тумана и фона сцены — глубокий оттенок мира */
  fog: string;
  idle: IdleProfile;
}

/**
 * Порядок — по кольцу коллекции: рядом с первым (выбранным при входе) стоят не те коты, что показаны в
 * соседних секциях (Странник и Токсик — на дальней стороне кольца).
 */
export const CATS: readonly SiteCat[] = [
  {
    id: 'stealth_assassin',
    name: 'Stealth Assassin',
    subtitle: 'The Silent Hunter',
    rarity: 'LEGENDARY',
    world: 'Shadow District',
    story:
      'A master of precision and patience. Moving through the shadows, this legendary cat waits for the perfect moment to strike.',
    power: 94,
    element: 'Assassin',
    accent: '#5fe0ff',
    accent2: '#c6f4ff',
    fog: '#04080d',
    idle: { breath: 0.5, breathPeriod: 4.8, blinkEvery: 6.5, tail: 0.6, ears: 1.2, head: 0.3, shoulders: 0 },
  },
  {
    id: 'galaxy_emperor',
    name: 'Galaxy Emperor',
    subtitle: 'The Ruler Beyond the Stars',
    rarity: 'MYTHIC',
    world: 'Galaxy Frontier',
    story:
      'A cosmic sovereign surrounded by ancient energy. His power comes from worlds far beyond the known universe.',
    power: 98,
    element: 'Cosmic',
    accent: '#9b7bff',
    accent2: '#ffd98f',
    fog: '#070519',
    idle: { breath: 0.8, breathPeriod: 5, blinkEvery: 5.5, tail: 0.5, ears: 0.3, head: 0.6, shoulders: 0.3 },
  },
  {
    id: 'ocean_guardian',
    name: 'Ocean Guardian',
    subtitle: 'Keeper of the Deep',
    rarity: 'LEGENDARY',
    world: 'Ocean Realm',
    story: 'An ancient guardian protecting the secrets hidden beneath the deepest waters.',
    power: 91,
    element: 'Guardian',
    accent: '#2fd2c9',
    accent2: '#a8fff4',
    fog: '#031012',
    idle: {
      breath: 0.9,
      breathPeriod: 4.4,
      blinkEvery: 4.2,
      tail: 0.8,
      ears: 0.7,
      head: 0.5,
      shoulders: 0.2,
    },
  },
  {
    id: 'cyber_samurai',
    name: 'Cyber Samurai',
    subtitle: 'The Neon Blade',
    rarity: 'LEGENDARY',
    world: 'Neon Shrine',
    story: 'A warrior forged between tradition and technology. Fast, precise and impossible to predict.',
    power: 95,
    element: 'Warrior',
    accent: '#ff3d5a',
    accent2: '#ffb3c0',
    fog: '#12040a',
    idle: { breath: 0.7, breathPeriod: 3.7, blinkEvery: 5, tail: 0.7, ears: 0.9, head: 0.4, shoulders: 0.6 },
  },
  {
    id: 'inferno',
    name: 'Inferno',
    subtitle: 'Keeper of the Last Spark',
    rarity: 'LEGENDARY',
    world: 'Ember Caves',
    story: 'Born in the heart of a volcano. Wherever he walks, the stone stays warm for a long time.',
    power: 92,
    element: 'Fire',
    accent: '#ff7a1a',
    accent2: '#ffc35a',
    fog: '#120603',
    idle: { breath: 1, breathPeriod: 3.9, blinkEvery: 4.5, tail: 1, ears: 0.6, head: 0.5, shoulders: 0 },
  },
  {
    id: 'toxic',
    name: 'Toxic',
    subtitle: 'Reactor Engineer',
    rarity: 'EPIC',
    world: 'Neon Plant',
    story: 'Repairs the reactors no one else dares to approach. Never takes the goggles off, even asleep.',
    power: 78,
    element: 'Engineer',
    accent: '#7dff3a',
    accent2: '#d4ff5a',
    fog: '#050c05',
    idle: { breath: 0.9, breathPeriod: 3.5, blinkEvery: 7, tail: 0.4, ears: 1, head: 1, shoulders: 0 },
  },
  {
    id: 'desert_nomad',
    name: 'Desert Nomad',
    subtitle: 'Guide Through the Storms',
    rarity: 'RARE',
    world: 'Sand Citadel',
    story: 'Knows every path to the citadel on the horizon. His goggles remember a caravan he never left.',
    power: 63,
    element: 'Explorer',
    accent: '#f2a65a',
    accent2: '#ffd9a0',
    fog: '#130b06',
    idle: { breath: 0.7, breathPeriod: 4.1, blinkEvery: 3.2, tail: 0.5, ears: 0.5, head: 0.4, shoulders: 1 },
  },
  {
    id: 'sakura_blossom',
    name: 'Sakura',
    subtitle: 'Voice of the Blooming Shrine',
    rarity: 'EPIC',
    world: 'Blossom Shrine',
    story: 'Keeper of the red torii. The wind brings her petals from every garden that remembers her.',
    power: 74,
    element: 'Spirit',
    accent: '#ff7eb6',
    accent2: '#ffd1e6',
    fog: '#160a12',
    idle: { breath: 0.6, breathPeriod: 4.4, blinkEvery: 3.6, tail: 0.9, ears: 1.3, head: 0.4, shoulders: 0 },
  },
  {
    id: 'lunar_witch',
    name: 'Lunar Witch',
    subtitle: 'Spells of the Full Moon',
    rarity: 'LEGENDARY',
    world: 'Moonlit City',
    story: 'She casts violet fire over the rooftops of the old city. Her staff remembers a hundred spells.',
    power: 88,
    element: 'Mystic',
    accent: '#b04dff',
    accent2: '#e3b8ff',
    fog: '#0b0620',
    idle: { breath: 0.6, breathPeriod: 4.2, blinkEvery: 4, tail: 1, ears: 0, head: 0.6, shoulders: 0 },
  },
  {
    id: 'crystal_prince',
    name: 'Crystal Prince',
    subtitle: 'Heir to the Buried Crown',
    rarity: 'MYTHIC',
    world: 'Amethyst Ruins',
    story: 'The last of the royal line. Crystals grow wherever he stands for longer than a minute.',
    power: 97,
    element: 'Crystal',
    accent: '#8f7bff',
    accent2: '#8fd8ff',
    fog: '#07071a',
    idle: { breath: 1, breathPeriod: 4.6, blinkEvery: 5, tail: 0.3, ears: 0.4, head: 0.8, shoulders: 0.4 },
  },
];

/** Главный персонаж сайта — чёрный кот Inferno. */
export const HERO_CAT = catById('inferno');

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic',
};

/** Самый сильный персонаж — фон финального экрана. */
export const STRONGEST_CAT = catById('galaxy_emperor');

/** Геометрия арта (build.mjs site): пропорции персонажа, голова, вертикаль тела, рамка в его мире. */
export interface CatArt {
  aspect: number;
  head: [number, number];
  body: number;
  scene: { aspect: number; char: [number, number, number, number] };
  /** лицо (scripts/skins/face.py site): глаза [x, y, rx, ry], эллипс головы, шея, уши [кончик xy, основание xy] */
  face: {
    eyes: Array<[number, number, number, number]>;
    head: [number, number, number, number];
    neck: [number, number];
    ears: Array<[number, number, number, number]>;
    /** хвост: [основание x, y, кончик x, y] */
    tail: [number, number, number, number] | null;
  };
}

const ART = art as unknown as Record<string, CatArt>;

export function catArt(id: string): CatArt {
  const a = ART[id];
  if (!a) throw new Error(`site cat art: ${id}`);
  return a;
}

export function catById(id: string): SiteCat {
  const cat = CATS.find((c) => c.id === id);
  if (!cat) throw new Error(`site cat: ${id}`);
  return cat;
}

export type CatFile = 'character' | 'background';
export const CAT_SIZES: Record<CatFile, readonly number[]> = assets.sizes;

/** Наименьший размер, которого хватает месту на экране в пикселях экрана; иначе — самый большой. */
export function catSize(file: CatFile, cssPx: number, ratio = pixelRatio()): number {
  const need = cssPx * ratio;
  const sizes = CAT_SIZES[file];
  return sizes.find((s) => s >= need) ?? sizes[sizes.length - 1]!;
}

export function catAsset(id: string, file: CatFile, size: number, format: 'avif' | 'webp'): string {
  return `${import.meta.env.BASE_URL}assets/site/cats/${id}/${file}-${size}.${format}`;
}

export function catIcon(id: string): string {
  return `${import.meta.env.BASE_URL}assets/site/cats/${id}/icon.webp`;
}
