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
 * Скин — перекраска персонажа (неон одежды, глаза, кроссовки, кнопка TAP; картинки собирает
 * scripts/hero при сборке) и оформление вокруг: цвет ауры и огоньков, частицы.
 */
export interface SkinStyle {
  /** основной цвет неона: аура, огоньки, кольцо кнопки */
  accent: string;
  /** второй цвет: блики и переливы */
  accent2: string;
  /** частицы, парящие вокруг кота (null — без частиц) */
  particle: ParticleKind | null;
}

export const SKIN_STYLES: Record<string, SkinStyle> = {
  black_crown: { accent: '#2f7bff', accent2: '#7fd8ff', particle: null },
  pink_angel: { accent: '#ff7ac8', accent2: '#ffd1ec', particle: 'heart' },
  cyber: { accent: '#19e3ff', accent2: '#7ffff0', particle: 'spark' },
  crypto_king: { accent: '#ff9d2e', accent2: '#ffd36b', particle: 'coin' },
  samurai: { accent: '#ff2e3e', accent2: '#ff9a9a', particle: 'petal' },
  neon_tokyo: { accent: '#e84dff', accent2: '#ff7ad9', particle: 'note' },
  shadow: { accent: '#7a2cff', accent2: '#b06bff', particle: 'smoke' },
  galaxy: { accent: '#6f5bff', accent2: '#2ed3c6', particle: 'star' },
  golden_boss: { accent: '#ffc93c', accent2: '#fff1a8', particle: 'gold' },
  hacker: { accent: '#39ff88', accent2: '#b6ffd2', particle: 'code' },
  diamond: { accent: '#9fdcff', accent2: '#ffffff', particle: 'diamond' },
  queen: { accent: '#ff3f7a', accent2: '#ffd27a', particle: 'heart' },
  legendary_crown: { accent: '#4d7bff', accent2: '#ff4fd8', particle: 'neon' },
};

const known = (id: string | undefined) => (id && SKIN_STYLES[id] ? id : DEFAULT_SKIN_ID);

export function skinStyle(id: string | undefined): SkinStyle {
  return SKIN_STYLES[known(id)]!;
}

export function skinRarity(id: string | undefined): Rarity {
  return cosmeticById(id ?? '')?.rarity ?? 'COMMON';
}

/** Картинки скина, собранные scripts/hero: тело и хвост (главный экран), превью, кнопка TAP. */
export function heroAsset(id: string | undefined, part: 'body' | 'tail' | 'thumb' | 'tap'): string {
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

const cat = layout.cat;
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

/** Геометрия персонажа (доли рамки кота) — из heroLayout.json, который сверяет сборка картинок. */
export const HERO = {
  /** ширина / высота кота */
  aspect: cat.width / cat.height,
  /** ширина / высота кнопки TAP */
  tapAspect: layout.tap.width / layout.tap.height,
  viewBox: `0 0 ${cat.width} ${cat.height}`,
  tailOrigin: `${pct(layout.tailPivot[0]! - cat.left, cat.width)} ${pct(layout.tailPivot[1]! - cat.top, cat.height)}`,
  /** голова: доли ширины и высоты (для облачка эмоций) */
  head: { x: (layout.head[0]! - cat.left) / cat.width, y: (layout.head[1]! - cat.top) / cat.height },
  eyes: layout.eyes.map((e) => ({ ...e, cx: e.cx - cat.left, cy: e.cy - cat.top })),
  leds: layout.leds.map((l) => ({
    left: pct(l.x - cat.left, cat.width),
    top: pct(l.y - cat.top, cat.height),
    size: pct(l.r * 2, cat.width),
  })),
  /** центр лапки на кнопке: доли кнопки */
  paw: {
    x: (layout.tapPaw[0]! - layout.tap.left) / layout.tap.width,
    y: (layout.tapPaw[1]! - layout.tap.top) / layout.tap.height,
  },
};
