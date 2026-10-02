import { cosmeticById, DEFAULT_SKIN_ID, type Rarity } from '@meowgul/shared';
import type { CSSProperties } from 'react';
import layout from './heroLayout.json';

/** Частицы вокруг кота и из-под пальца. */
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
 * Скин — внешний вид кота: картинки слоёв (собирает scripts/hero), «скелет» (rig: где голова, хвост,
 * глаза — по нему двигаются слои) и оформление вокруг: цвет ауры и огоньков, частицы. Тап, анимации,
 * награды и эффекты одинаковы для всех котов: новый кот = картинки + rig + строка здесь.
 */
export interface SkinStyle {
  /** скелет персонажа (CAT_RIGS) */
  rig: RigId;
  /** основной цвет неона: аура, огоньки, кольцо кнопки */
  accent: string;
  /** второй цвет: блики и переливы */
  accent2: string;
  /** частицы, парящие вокруг кота (null — без частиц) */
  particle: ParticleKind | null;
}

export const SKIN_STYLES: Record<string, SkinStyle> = {
  black_crown: { rig: 'street', accent: '#2f7bff', accent2: '#7fd8ff', particle: null },
  pink_angel: { rig: 'street', accent: '#ff7ac8', accent2: '#ffd1ec', particle: 'heart' },
  cyber: { rig: 'street', accent: '#19e3ff', accent2: '#7ffff0', particle: 'spark' },
  crypto_king: { rig: 'street', accent: '#ff9d2e', accent2: '#ffd36b', particle: 'coin' },
  samurai: { rig: 'street', accent: '#ff2e3e', accent2: '#ff9a9a', particle: 'petal' },
  neon_tokyo: { rig: 'street', accent: '#e84dff', accent2: '#ff7ad9', particle: 'note' },
  shadow: { rig: 'street', accent: '#7a2cff', accent2: '#b06bff', particle: 'smoke' },
  galaxy: { rig: 'street', accent: '#6f5bff', accent2: '#2ed3c6', particle: 'star' },
  golden_boss: { rig: 'street', accent: '#ffc93c', accent2: '#fff1a8', particle: 'gold' },
  hacker: { rig: 'street', accent: '#39ff88', accent2: '#b6ffd2', particle: 'code' },
  diamond: { rig: 'street', accent: '#9fdcff', accent2: '#ffffff', particle: 'diamond' },
  queen: { rig: 'street', accent: '#ff3f7a', accent2: '#ffd27a', particle: 'heart' },
  legendary_crown: { rig: 'street', accent: '#4d7bff', accent2: '#ff4fd8', particle: 'neon' },
};

const known = (id: string | undefined) => (id && SKIN_STYLES[id] ? id : DEFAULT_SKIN_ID);

export function skinStyle(id: string | undefined): SkinStyle {
  return SKIN_STYLES[known(id)]!;
}

export function skinRarity(id: string | undefined): Rarity {
  return cosmeticById(id ?? '')?.rarity ?? 'COMMON';
}

export type HeroPart = 'body' | 'head' | 'ear' | 'tail' | 'foot' | 'thumb';

/** Картинки скина, собранные scripts/hero: слои тела, головы, уха, хвоста и кроссовки (главный экран) и превью целиком. */
export function heroAsset(id: string | undefined, part: HeroPart): string {
  return `/assets/generated/hero/${known(id)}-${part}.webp`;
}

/** CSS-переменные цветов скина для ауры, огоньков и кнопки. */
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

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

/** Скелет персонажа: геометрия слоёв в долях его рамки. По нему двигаются голова, ухо, хвост, кроссовка, веки и огоньки. */
export interface CatRig {
  /** ширина / высота кота */
  aspect: number;
  viewBox: string;
  tailOrigin: string;
  headOrigin: string;
  /** основание подвижного уха и носок притопывающей кроссовки */
  earOrigin: string;
  footOrigin: string;
  /** голова: доли ширины и высоты (облачко эмоций, граница «тап по голове») */
  head: { x: number; y: number };
  /** нижний край головы (доля высоты): выше — тап по голове */
  headBottom: number;
  eyes: Array<{ cx: number; cy: number; rx: number; ry: number; rot: number }>;
  leds: Array<{ left: string; top: string; size: string }>;
}

function rigFromLayout(l: typeof layout): CatRig {
  const c = l.cat;
  return {
    aspect: c.width / c.height,
    viewBox: `0 0 ${c.width} ${c.height}`,
    tailOrigin: `${pct(l.tailPivot[0]! - c.left, c.width)} ${pct(l.tailPivot[1]! - c.top, c.height)}`,
    headOrigin: `${pct(l.headPivot[0]! - c.left, c.width)} ${pct(l.headPivot[1]! - c.top, c.height)}`,
    earOrigin: `${pct(l.earPivot[0]! - c.left, c.width)} ${pct(l.earPivot[1]! - c.top, c.height)}`,
    footOrigin: `${pct(l.footPivot[0]! - c.left, c.width)} ${pct(l.footPivot[1]! - c.top, c.height)}`,
    head: { x: (l.head[0]! - c.left) / c.width, y: (l.head[1]! - c.top) / c.height },
    headBottom: (l.headPivot[1]! - c.top) / c.height,
    eyes: l.eyes.map((e) => ({ ...e, cx: e.cx - c.left, cy: e.cy - c.top })),
    leds: l.leds.map((d) => ({
      left: pct(d.x - c.left, c.width),
      top: pct(d.y - c.top, c.height),
      size: pct(d.r * 2, c.width),
    })),
  };
}

/** Скелеты персонажей. Сейчас один — кот в стритвире; новые коты добавляют свой (свой heroLayout). */
export const CAT_RIGS = { street: rigFromLayout(layout) } satisfies Record<string, CatRig>;
export type RigId = keyof typeof CAT_RIGS;

export function skinRig(id: string | undefined): CatRig {
  return CAT_RIGS[skinStyle(id).rig];
}
