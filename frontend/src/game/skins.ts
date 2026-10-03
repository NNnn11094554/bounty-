import { cosmeticById, DEFAULT_SKIN_ID, type Rarity } from '@meowgul/shared';
import type { CSSProperties } from 'react';
import art from './skinArt.json';

/** Частицы из-под пальца (эффект тапа) и всплески реакций кота. */
export type ParticleKind =
  | 'heart'
  | 'spark'
  | 'coin'
  | 'petal'
  | 'note'
  | 'smoke'
  | 'star'
  | 'gold'
  | 'code'
  | 'diamond'
  | 'neon'
  | 'bolt';

/**
 * Атмосфера сцены: лёгкие частицы поверх фона (только transform и opacity, на слабых устройствах — меньше).
 * Падающие частицы летят с одним ветром на всю сцену (у каждой — лишь лёгкое покачивание).
 * neon — неоновые огоньки города медленно плывут вверх, snow — снег, petals — лепестки, embers — искры огня вверх, stars — мерцание,
 * bubbles — пузырьки, fireflies — светлячки, sparks — быстрые искры вверх, sand — песок по ветру,
 * spores — кислотные споры, feathers — перья, shards — кристаллы, bats — летучие мыши, smoke — дымка,
 * magic — искры чар.
 */
export type AmbientKind =
  | 'neon'
  | 'snow'
  | 'petals'
  | 'embers'
  | 'stars'
  | 'bubbles'
  | 'fireflies'
  | 'sparks'
  | 'sand'
  | 'spores'
  | 'feathers'
  | 'shards'
  | 'bats'
  | 'smoke'
  | 'magic';

/**
 * Спокойная анимация персонажа (бесшовный цикл, только transform от ступней):
 * breathe — дыхание, float — парит в невесомости, sway — покачивание с ноги на ногу,
 * hover — висит на реакторах/чарах с лёгким креном, flicker — дыхание с пульсом свечения, bob — кивает в ритм.
 */
export type IdleKind = 'breathe' | 'float' | 'sway' | 'hover' | 'flicker' | 'bob';

/**
 * Скин — отдельный персонаж: картинка (scripts/skins), сцена-фон, атмосфера, спокойная анимация и
 * всплеск на тап. Тап, награды и физика реакции общие для всех: новый персонаж = картинки + строка здесь.
 */
export interface SkinStyle {
  /** основной цвет: аура, свет на полу, кольца тапа, частицы атмосферы */
  accent: string;
  /** второй цвет: блики и переливы */
  accent2: string;
  ambient: AmbientKind;
  idle: IdleKind;
  /** частица всплеска на каждый тап поверх эффекта тапа */
  burst: ParticleKind;
}

export const SKIN_STYLES: Record<string, SkinStyle> = {
  neon_punk: { accent: '#22d3ff', accent2: '#ff3fd8', ambient: 'neon', idle: 'bob', burst: 'neon' },
  desert_nomad: { accent: '#ffb35c', accent2: '#ffe0a3', ambient: 'sand', idle: 'sway', burst: 'gold' },
  sakura_blossom: {
    accent: '#ff8ac0',
    accent2: '#ffe0ee',
    ambient: 'petals',
    idle: 'breathe',
    burst: 'petal',
  },
  astro_cat: { accent: '#8ec5ff', accent2: '#ffffff', ambient: 'stars', idle: 'float', burst: 'star' },
  mecha: { accent: '#4db8ff', accent2: '#e6f4ff', ambient: 'sparks', idle: 'hover', burst: 'bolt' },
  crystal_prince: {
    accent: '#b48bff',
    accent2: '#8fe3ff',
    ambient: 'shards',
    idle: 'hover',
    burst: 'diamond',
  },
  forest_spirit: {
    accent: '#a5e85d',
    accent2: '#ffd36b',
    ambient: 'fireflies',
    idle: 'sway',
    burst: 'spark',
  },
  ocean_guardian: {
    accent: '#3fd0ff',
    accent2: '#2a6bff',
    ambient: 'bubbles',
    idle: 'float',
    burst: 'diamond',
  },
  inferno: { accent: '#ff7a1a', accent2: '#ffd23c', ambient: 'embers', idle: 'flicker', burst: 'gold' },
  toxic: { accent: '#59ff3f', accent2: '#d4ff3f', ambient: 'spores', idle: 'flicker', burst: 'spark' },
  stealth_assassin: {
    accent: '#ff3b6b',
    accent2: '#ffb7d5',
    ambient: 'petals',
    idle: 'sway',
    burst: 'petal',
  },
  dark_reaper: { accent: '#8a3bff', accent2: '#c9a4ff', ambient: 'smoke', idle: 'sway', burst: 'smoke' },
  arctic_king: { accent: '#7fd0ff', accent2: '#ffffff', ambient: 'snow', idle: 'breathe', burst: 'diamond' },
  vampire_lord: { accent: '#ff2b4a', accent2: '#ff9a7a', ambient: 'bats', idle: 'breathe', burst: 'heart' },
  lunar_witch: { accent: '#b45bff', accent2: '#e6d6ff', ambient: 'magic', idle: 'float', burst: 'star' },
  royal_emperor: { accent: '#ffc93c', accent2: '#ff5a3c', ambient: 'sparks', idle: 'breathe', burst: 'gold' },
  angel_guardian: {
    accent: '#ffe7a3',
    accent2: '#9fd8ff',
    ambient: 'feathers',
    idle: 'float',
    burst: 'star',
  },
  shadow_drifter: { accent: '#a24bff', accent2: '#6a8bff', ambient: 'smoke', idle: 'sway', burst: 'smoke' },
  cyber_samurai: { accent: '#ff2a3c', accent2: '#ff9aa8', ambient: 'petals', idle: 'sway', burst: 'petal' },
  galaxy_emperor: { accent: '#7a5cff', accent2: '#ff4fd8', ambient: 'stars', idle: 'float', burst: 'star' },
};

/** Геометрия картинки персонажа (собирает scripts/skins): пропорции, голова, центр тела. */
export interface SkinArt {
  /** ширина / высота картинки персонажа */
  aspect: number;
  /** центр головы: доли ширины и высоты */
  head: [number, number];
  /** вертикаль центра тела (доля ширины): по ней персонаж ставится в центр сцены */
  body: number;
  /** нижний край головы (доля высоты): выше — тап по голове */
  headBottom: number;
  /**
   * Сцена (фон): пропорции и рамка персонажа в ней (доли: x, y, ширина, высота). Фон ставится так, чтобы
   * персонаж на экране стоял точно там, где стоял в своём мире, и закрывал своё место на картинке.
   */
  scene: { aspect: number; char: [number, number, number, number] };
  /** лицо для «живого» персонажа (scripts/skins/face.py) */
  face: SkinFace;
}

/**
 * Лицо персонажа: всё в долях картинки (x и rx — от ширины, y и ry — от высоты).
 * Глаза моргают и смотрят по сторонам, голова чуть наклоняется вокруг шеи — тело при этом неподвижно.
 */
export interface SkinFace {
  /** эллипсы глаз [x, y, rx, ry] */
  eyes: Array<[number, number, number, number]>;
  /** цвет века (мех над глазом) — подложка под текстуру века */
  lid: string;
  /** линия сомкнутых ресниц */
  lash: string;
  /** эллипс головы [x, y, rx, ry]: слой наклона головы */
  head: [number, number, number, number];
  /** точка поворота головы — шея */
  neck: [number, number];
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Где нарисовать фон сцены, чтобы персонаж (fit — его рамка на экране) стоял на своём месте. Если при этом
 * фон не закрывает всю область (очень широкий или высокий экран), он увеличивается от ступней персонажа.
 */
export function sceneRect(id: string | undefined, fit: Rect, box: { width: number; height: number }): Rect {
  const { aspect, char } = skinArt(id).scene;
  const height = fit.height / char[3];
  const width = height * aspect;
  const left = fit.left - char[0] * width;
  const top = fit.top - char[1] * height;
  // точка опоры — ступни персонажа: при увеличении он остаётся на месте
  const ax = fit.left + fit.width / 2;
  const ay = fit.top + fit.height;
  const need = (gap: number, span: number) => (gap > 0 && span > 0 ? gap / span : 1);
  const k = Math.max(
    1,
    need(ax, ax - left),
    need(box.width - ax, left + width - ax),
    need(ay, ay - top),
    need(box.height - ay, top + height - ay),
  );
  return {
    left: ax - (ax - left) * k,
    top: ay - (ay - top) * k,
    width: width * k,
    height: height * k,
  };
}

const ART = art as unknown as Record<string, SkinArt>;

const known = (id: string | undefined) => (id && SKIN_STYLES[id] && ART[id] ? id : DEFAULT_SKIN_ID);

export function skinId(id: string | undefined): string {
  return known(id);
}

export function skinStyle(id: string | undefined): SkinStyle {
  return SKIN_STYLES[known(id)]!;
}

export function skinArt(id: string | undefined): SkinArt {
  return ART[known(id)]!;
}

export function skinRarity(id: string | undefined): Rarity {
  return cosmeticById(known(id))?.rarity ?? 'EPIC';
}

export type SkinFile = 'character' | 'background' | 'preview';

/** Картинка скина: AVIF и WebP (браузер выберет сам через <picture>). */
export function skinAsset(id: string | undefined, file: SkinFile, format: 'avif' | 'webp' = 'webp'): string {
  return `/assets/skins/${known(id)}/${file}.${format}`;
}

/**
 * Картинка скина фоном div (а не <img>: долгое нажатие в WebView не откроет меню картинки): CSS-переменные
 * для класса .skin-img — AVIF через image-set, где браузер это умеет, иначе WebP.
 */
export function skinImage(id: string | undefined, file: SkinFile): CSSProperties {
  return {
    ['--img-avif' as string]: `url(${skinAsset(id, file, 'avif')})`,
    ['--img-webp' as string]: `url(${skinAsset(id, file, 'webp')})`,
  };
}

/** Браузер выберет AVIF (image-set с type() — Chrome 113+, Safari 17+), иначе WebP. */
let avif: boolean | null = null;
function avifPreferred(): boolean {
  if (avif === null) {
    avif =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('background-image', 'image-set(url("a.avif") type("image/avif"))');
  }
  return avif;
}

/** Портрет (голова и плечи на фоне сцены) — аватары, мелкие значки. */
export function skinIcon(id: string | undefined): string {
  return `/assets/skins/${known(id)}/icon.webp`;
}

/** CSS-переменные цветов скина: аура, свет, кольца тапа, частицы. */
export function skinVars(id: string | undefined): CSSProperties {
  const s = skinStyle(id);
  return { ['--accent' as string]: s.accent, ['--accent2' as string]: s.accent2 };
}

/** Эффект тапа (косметика) → частица из-под пальца. */
export const EFFECT_PARTICLE: Record<string, ParticleKind> = {
  coins: 'coin',
  hearts: 'heart',
  stars: 'star',
  sakura: 'petal',
  lightning: 'bolt',
  matrix: 'code',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#c0c7d1',
  RARE: '#38c8ff',
  EPIC: '#b06bff',
  LEGENDARY: '#ffc93c',
  MYTHIC: '#ff4fa3',
};

/**
 * Слабое устройство или упрощённые анимации: сцена без медленного «дыхания» фона и с меньшим числом
 * частиц. Решение принимается один раз за запуск (характеристики устройства не меняются).
 */
let lite: boolean | null = null;
export function liteDevice(): boolean {
  if (lite !== null) return lite;
  const nav = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  lite =
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 3) ||
    nav.connection?.saveData === true;
  return lite;
}

/** Только для тестов: сбросить определение слабого устройства. */
export function resetLiteDevice(value: boolean | null = null): void {
  lite = value;
}

const preloaded = new Map<string, Promise<void>>();

/**
 * Загрузить и декодировать картинки скина заранее (персонаж и фон), чтобы смена прошла без «мигания».
 * Никогда не падает и не ждёт дольше timeoutMs: медленная сеть не блокирует надевание.
 */
export function preloadSkin(id: string, timeoutMs = 1500): Promise<void> {
  const key = known(id);
  let p = preloaded.get(key);
  if (!p) {
    const load = (src: string) =>
      new Promise<void>((resolve) => {
        if (typeof Image === 'undefined') return resolve();
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          const done = img.decode ? img.decode().catch(() => undefined) : Promise.resolve();
          void done.then(() => resolve());
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    const format = avifPreferred() ? 'avif' : 'webp';
    p = Promise.all([
      load(skinAsset(key, 'character', format)),
      load(skinAsset(key, 'background', format)),
    ]).then(() => undefined);
    preloaded.set(key, p);
  }
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
