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

/** Персонаж сайта: тексты (имя, подзаголовок, мир, история, тип) — в словарях i18n (cats.<id>). */
export interface SiteCat {
  id: string;
  rarity: Rarity;
  /** сила персонажа в лоре (на экономику игры скины не влияют) */
  power: number;
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
    rarity: 'LEGENDARY',
    power: 94,
    accent: '#5fe0ff',
    accent2: '#c6f4ff',
    fog: '#04080d',
    idle: { breath: 0.5, breathPeriod: 4.8, blinkEvery: 6.5, tail: 0.6, ears: 1.2, head: 0.3, shoulders: 0 },
  },
  {
    id: 'galaxy_emperor',
    rarity: 'MYTHIC',
    power: 98,
    accent: '#9b7bff',
    accent2: '#ffd98f',
    fog: '#070519',
    idle: { breath: 0.8, breathPeriod: 5, blinkEvery: 5.5, tail: 0.5, ears: 0.3, head: 0.6, shoulders: 0.3 },
  },
  {
    id: 'ocean_guardian',
    rarity: 'LEGENDARY',
    power: 91,
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
    rarity: 'LEGENDARY',
    power: 95,
    accent: '#ff3d5a',
    accent2: '#ffb3c0',
    fog: '#12040a',
    idle: { breath: 0.7, breathPeriod: 3.7, blinkEvery: 5, tail: 0.7, ears: 0.9, head: 0.4, shoulders: 0.6 },
  },
  {
    id: 'inferno',
    rarity: 'LEGENDARY',
    power: 92,
    accent: '#ff7a1a',
    accent2: '#ffc35a',
    fog: '#120603',
    idle: { breath: 1, breathPeriod: 3.9, blinkEvery: 4.5, tail: 1, ears: 0.6, head: 0.5, shoulders: 0 },
  },
  {
    id: 'toxic',
    rarity: 'EPIC',
    power: 78,
    accent: '#7dff3a',
    accent2: '#d4ff5a',
    fog: '#050c05',
    idle: { breath: 0.9, breathPeriod: 3.5, blinkEvery: 7, tail: 0.4, ears: 1, head: 1, shoulders: 0 },
  },
  {
    id: 'desert_nomad',
    rarity: 'RARE',
    power: 63,
    accent: '#f2a65a',
    accent2: '#ffd9a0',
    fog: '#130b06',
    idle: { breath: 0.7, breathPeriod: 4.1, blinkEvery: 3.2, tail: 0.5, ears: 0.5, head: 0.4, shoulders: 1 },
  },
  {
    id: 'sakura_blossom',
    rarity: 'EPIC',
    power: 74,
    accent: '#ff7eb6',
    accent2: '#ffd1e6',
    fog: '#160a12',
    idle: { breath: 0.6, breathPeriod: 4.4, blinkEvery: 3.6, tail: 0.9, ears: 1.3, head: 0.4, shoulders: 0 },
  },
  {
    id: 'lunar_witch',
    rarity: 'LEGENDARY',
    power: 88,
    accent: '#b04dff',
    accent2: '#e3b8ff',
    fog: '#0b0620',
    idle: { breath: 0.6, breathPeriod: 4.2, blinkEvery: 4, tail: 1, ears: 0, head: 0.6, shoulders: 0 },
  },
  {
    id: 'crystal_prince',
    rarity: 'MYTHIC',
    power: 97,
    accent: '#8f7bff',
    accent2: '#8fd8ff',
    fog: '#07071a',
    idle: { breath: 1, breathPeriod: 4.6, blinkEvery: 5, tail: 0.3, ears: 0.4, head: 0.8, shoulders: 0.4 },
  },
];

/** Главный персонаж сайта — чёрный кот Inferno. */
export const HERO_CAT = catById('inferno');

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
