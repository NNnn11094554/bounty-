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

export const CATS: readonly SiteCat[] = [
  {
    id: 'inferno',
    name: 'Инферно',
    subtitle: 'Хранитель последней искры',
    rarity: 'LEGENDARY',
    world: 'Огненные пещеры',
    story: 'Чёрный кот, рождённый в сердце вулкана. Там, где он прошёл, камень ещё долго хранит тепло.',
    power: 92,
    element: 'Огонь',
    accent: '#ff7a1a',
    accent2: '#ffc35a',
    fog: '#120603',
    idle: { breath: 1, breathPeriod: 3.9, blinkEvery: 4.5, tail: 1, ears: 0.6, head: 0.5, shoulders: 0 },
  },
  {
    id: 'sakura_blossom',
    name: 'Сакура',
    subtitle: 'Голос цветущего храма',
    rarity: 'EPIC',
    world: 'Храм цветущей сакуры',
    story: 'Хранительница красных тории. Ветер приносит ей лепестки со всех садов, где о ней помнят.',
    power: 74,
    element: 'Ветер',
    accent: '#ff7eb6',
    accent2: '#ffd1e6',
    fog: '#160a12',
    idle: { breath: 0.6, breathPeriod: 4.4, blinkEvery: 3.6, tail: 0.9, ears: 1.3, head: 0.4, shoulders: 0 },
  },
  {
    id: 'toxic',
    name: 'Токсик',
    subtitle: 'Инженер кислотных реакторов',
    rarity: 'EPIC',
    world: 'Химзавод Неон-Сити',
    story: 'Чинит реакторы, к которым боятся подходить люди. Видит в темноте и не снимает очки даже во сне.',
    power: 78,
    element: 'Яд',
    accent: '#7dff3a',
    accent2: '#d4ff5a',
    fog: '#050c05',
    idle: { breath: 0.9, breathPeriod: 3.5, blinkEvery: 7, tail: 0.4, ears: 1, head: 1, shoulders: 0 },
  },
  {
    id: 'desert_nomad',
    name: 'Странник',
    subtitle: 'Проводник песчаных бурь',
    rarity: 'RARE',
    world: 'Барханы Песчаной цитадели',
    story:
      'Знает каждую тропу к цитадели на горизонте. Лётные очки — память о караване, который он не бросил.',
    power: 63,
    element: 'Песок',
    accent: '#f2a65a',
    accent2: '#ffd9a0',
    fog: '#130b06',
    idle: { breath: 0.7, breathPeriod: 4.1, blinkEvery: 3.2, tail: 0.5, ears: 0.5, head: 0.4, shoulders: 1 },
  },
  {
    id: 'crystal_prince',
    name: 'Кристальный принц',
    subtitle: 'Наследник подземной короны',
    rarity: 'MYTHIC',
    world: 'Аметистовые руины',
    story: 'Последний из королевского рода руин. Кристаллы растут там, где он стоит дольше минуты.',
    power: 97,
    element: 'Кристалл',
    accent: '#8f7bff',
    accent2: '#8fd8ff',
    fog: '#07071a',
    idle: { breath: 1, breathPeriod: 4.6, blinkEvery: 5, tail: 0.3, ears: 0.4, head: 0.8, shoulders: 0.4 },
  },
  {
    id: 'lunar_witch',
    name: 'Лунная ведьма',
    subtitle: 'Чары полной луны',
    rarity: 'LEGENDARY',
    world: 'Город под полной луной',
    story: 'Колдует фиолетовым огнём над крышами старого города. Посох помнит сотню заклинаний.',
    power: 88,
    element: 'Луна',
    accent: '#b04dff',
    accent2: '#e3b8ff',
    fog: '#0b0620',
    idle: { breath: 0.6, breathPeriod: 4.2, blinkEvery: 4, tail: 1, ears: 0, head: 0.6, shoulders: 0 },
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
  return `${import.meta.env.BASE_URL}assets/site/cats/${id}/${file}-${size}.${format}`;
}

export function catIcon(id: string): string {
  return `${import.meta.env.BASE_URL}assets/site/cats/${id}/icon.webp`;
}
