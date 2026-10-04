import type { Rarity } from '@meowgul/shared';
import { pixelRatio } from '../game/skins';
import art from './catArt.json';
import assets from './catAssets.json';

/**
 * Персонажи сайта. Арт — те же исходники и тот же конвейер, что у скинов игры (scripts/skins:
 * compose.py → build.mjs site): персонаж с прозрачным фоном, его мир без персонажа и портрет.
 */
export interface SiteCat {
  id: string;
  name: string;
  rarity: Rarity;
  /** мир персонажа — подпись к атмосфере */
  world: string;
  story: string;
  /** основной цвет света, частиц и интерфейса */
  accent: string;
  /** второй цвет: блики, край проявления */
  accent2: string;
  /** цвет тумана и фона сцены — глубокий оттенок мира */
  fog: string;
  /** спокойная анимация: покачивание, парение или дыхание */
  idle: 'sway' | 'float' | 'breathe';
  /** характер одной строкой — для карточки */
  traits: [string, string, string];
}

export const CATS: readonly SiteCat[] = [
  {
    id: 'inferno',
    name: 'Инферно',
    rarity: 'LEGENDARY',
    world: 'Огненные пещеры',
    story: 'Чёрный кот из пламени — лицо Meowgul. Там, где он прошёл, ещё долго тлеют искры.',
    accent: '#ff7a1a',
    accent2: '#ffc35a',
    fog: '#120603',
    idle: 'sway',
    traits: ['Огонь', 'Лидер', 'Пламенный хвост'],
  },
  {
    id: 'sakura_blossom',
    name: 'Сакура',
    rarity: 'EPIC',
    world: 'Храм цветущей сакуры',
    story: 'Хранительница храма у красных тории. Лепестки кружатся там, куда она смотрит.',
    accent: '#ff7eb6',
    accent2: '#ffd1e6',
    fog: '#160a12',
    idle: 'breathe',
    traits: ['Нимб', 'Шёлк', 'Лепестки'],
  },
  {
    id: 'toxic',
    name: 'Токсик',
    rarity: 'EPIC',
    world: 'Химзавод Неон-Сити',
    story: 'Инженер кислотных реакторов. Светится в темноте и не снимает очки ночного видения.',
    accent: '#7dff3a',
    accent2: '#d4ff5a',
    fog: '#050c05',
    idle: 'sway',
    traits: ['Неон', 'Реактор', 'Ночное зрение'],
  },
  {
    id: 'desert_nomad',
    name: 'Странник',
    rarity: 'RARE',
    world: 'Барханы Песчаной цитадели',
    story: 'Ищет потерянные караваны среди дюн. Знает каждый путь к цитадели на горизонте.',
    accent: '#f2a65a',
    accent2: '#ffd9a0',
    fog: '#130b06',
    idle: 'breathe',
    traits: ['Песок', 'Плащ', 'Лётные очки'],
  },
  {
    id: 'crystal_prince',
    name: 'Кристальный принц',
    rarity: 'MYTHIC',
    world: 'Аметистовые руины',
    story: 'Наследник подземного королевства. Кристаллы растут там, где он стоит дольше минуты.',
    accent: '#8f7bff',
    accent2: '#8fd8ff',
    fog: '#07071a',
    idle: 'float',
    traits: ['Кристаллы', 'Броня', 'Корона'],
  },
  {
    id: 'lunar_witch',
    name: 'Лунная ведьма',
    rarity: 'LEGENDARY',
    world: 'Город под полной луной',
    story: 'Колдует фиолетовым огнём над крышами старого города. Посох помнит сотню заклинаний.',
    accent: '#b04dff',
    accent2: '#e3b8ff',
    fog: '#0b0620',
    idle: 'float',
    traits: ['Луна', 'Чары', 'Посох'],
  },
];

/** Главный персонаж сайта — чёрный кот Meowgul. */
export const HERO_CAT = CATS[0]!;

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: 'Обычный',
  RARE: 'Редкий',
  EPIC: 'Эпический',
  LEGENDARY: 'Легендарный',
  MYTHIC: 'Мифический',
};

/** Геометрия арта (build.mjs site): пропорции персонажа, голова, вертикаль тела, рамка в его мире. */
export interface CatArt {
  aspect: number;
  head: [number, number];
  body: number;
  scene: { aspect: number; char: [number, number, number, number] };
}

const ART = art as unknown as Record<string, CatArt>;

export function catArt(id: string): CatArt {
  const a = ART[id];
  if (!a) throw new Error(`site cat art: ${id}`);
  return a;
}

export function catById(id: string): SiteCat {
  return CATS.find((c) => c.id === id) ?? HERO_CAT;
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
  return `/assets/site/cats/${id}/${file}-${size}.${format}`;
}

export function catIcon(id: string): string {
  return `/assets/site/cats/${id}/icon.webp`;
}
