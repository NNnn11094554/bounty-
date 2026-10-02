import { cosmeticById, DEFAULT_SKIN_ID, type Rarity } from '@meowgul/shared';
import type { CSSProperties } from 'react';

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

export type AccessoryKind =
  | 'crown'
  | 'halo'
  | 'antenna'
  | 'coinCrown'
  | 'katana'
  | 'headphones'
  | 'horns'
  | 'planet'
  | 'bigCrown'
  | 'terminal'
  | 'gem'
  | 'tiara'
  | 'neonCrown';

/**
 * Оформление скина. Картинка персонажа не перерисовывается и не перекрашивается: скин — это кольцо,
 * ореол, частицы вокруг и аксессуар над головой. Отдельный арт скина (asset) подставляется вместо
 * базовой картинки, когда будет готов: положите файл в public/assets/skins и укажите путь здесь.
 */
/** Размещение аксессуара относительно круга с котом: доли от размера. Всё — над головой, не на лице. */
export const ACCESSORY_LAYOUT: Record<AccessoryKind, { w: number; top: number; x: number; vb: string }> = {
  crown: { w: 0.5, top: -0.24, x: 0, vb: '0 0 120 72' },
  halo: { w: 1.12, top: -0.2, x: 0, vb: '0 0 200 72' },
  antenna: { w: 0.62, top: -0.2, x: 0, vb: '0 0 120 72' },
  coinCrown: { w: 0.54, top: -0.26, x: 0, vb: '0 0 120 72' },
  katana: { w: 0.5, top: -0.16, x: 0.36, vb: '0 0 120 72' },
  headphones: { w: 1.08, top: -0.12, x: 0, vb: '0 0 140 90' },
  horns: { w: 0.52, top: -0.3, x: 0, vb: '0 0 120 72' },
  planet: { w: 0.46, top: -0.18, x: 0.34, vb: '0 0 120 72' },
  bigCrown: { w: 0.7, top: -0.32, x: 0, vb: '0 0 140 80' },
  terminal: { w: 0.4, top: -0.22, x: 0, vb: '0 0 120 72' },
  gem: { w: 0.34, top: -0.26, x: 0, vb: '0 0 120 100' },
  tiara: { w: 0.56, top: -0.2, x: 0, vb: '0 0 120 72' },
  neonCrown: { w: 0.6, top: -0.28, x: 0, vb: '0 0 120 72' },
};

/** На какую долю размера кота аксессуар выступает над кругом — столько места оставляем сверху. */
export function accessoryOverhang(skinId: string | undefined): number {
  return Math.max(0, -ACCESSORY_LAYOUT[skinStyle(skinId).accessory].top);
}

export interface SkinStyle {
  /** кольцо вокруг портрета: два цвета градиента */
  ring: [string, string];
  /** основной и второй цвет ореола */
  glow: string;
  glow2: string;
  /** частицы, кружащие вокруг (null — без частиц) */
  orbit: ParticleKind | null;
  accessory: AccessoryKind;
  /** отдельная картинка персонажа для скина (пока у всех — базовая) */
  asset?: string;
}

export const SKIN_STYLES: Record<string, SkinStyle> = {
  black_crown: {
    ring: ['#ffe08a', '#c98510'],
    glow: '#ffc93c',
    glow2: '#ff8a3d',
    orbit: null,
    accessory: 'crown',
  },
  pink_angel: {
    ring: ['#ffb3df', '#ff3d9a'],
    glow: '#ff5fb8',
    glow2: '#ffd1ec',
    orbit: 'heart',
    accessory: 'halo',
  },
  cyber: {
    ring: ['#7fe3ff', '#1e6bff'],
    glow: '#38c8ff',
    glow2: '#1e6bff',
    orbit: 'spark',
    accessory: 'antenna',
  },
  crypto_king: {
    ring: ['#fff1a8', '#d98f0b'],
    glow: '#ffc93c',
    glow2: '#ffe27a',
    orbit: 'coin',
    accessory: 'coinCrown',
  },
  samurai: {
    ring: ['#ff6b6b', '#5a0010'],
    glow: '#ff3b3b',
    glow2: '#ff9a9a',
    orbit: 'petal',
    accessory: 'katana',
  },
  neon_tokyo: {
    ring: ['#ff4fd8', '#7a5cff'],
    glow: '#ff4fd8',
    glow2: '#7a5cff',
    orbit: 'note',
    accessory: 'headphones',
  },
  shadow: {
    ring: ['#5b2a86', '#0b0612'],
    glow: '#7a2cff',
    glow2: '#ff2b5e',
    orbit: 'smoke',
    accessory: 'horns',
  },
  galaxy: {
    ring: ['#9b7bff', '#2ed3c6'],
    glow: '#7a5cff',
    glow2: '#2ed3c6',
    orbit: 'star',
    accessory: 'planet',
  },
  golden_boss: {
    ring: ['#fff6c2', '#b8740a'],
    glow: '#ffc93c',
    glow2: '#fff1a8',
    orbit: 'gold',
    accessory: 'bigCrown',
  },
  hacker: {
    ring: ['#39ff88', '#0b5d2a'],
    glow: '#39ff88',
    glow2: '#0bd46a',
    orbit: 'code',
    accessory: 'terminal',
  },
  diamond: {
    ring: ['#ffffff', '#8fb0ff'],
    glow: '#9fc1ff',
    glow2: '#b48cff',
    orbit: 'diamond',
    accessory: 'gem',
  },
  queen: {
    ring: ['#ff8fd0', '#1a0f1f'],
    glow: '#ff5fb8',
    glow2: '#ffc1e3',
    orbit: 'heart',
    accessory: 'tiara',
  },
  legendary_crown: {
    ring: ['#38c8ff', '#ff4fd8'],
    glow: '#38c8ff',
    glow2: '#ff4fd8',
    orbit: 'neon',
    accessory: 'neonCrown',
  },
};

export function skinStyle(id: string | undefined): SkinStyle {
  return SKIN_STYLES[id ?? DEFAULT_SKIN_ID] ?? SKIN_STYLES[DEFAULT_SKIN_ID]!;
}

export function skinRarity(id: string | undefined): Rarity {
  return cosmeticById(id ?? DEFAULT_SKIN_ID)?.rarity ?? 'COMMON';
}

/** Эффект тапа → частица, вылетающая из-под пальца. */
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
  RARE: '#4f9dff',
  EPIC: '#a66bff',
  LEGENDARY: '#ffc93c',
  MYTHIC: '#ff4fa3',
};

/**
 * CSS-переменные оформления скина (кольцо, ореол, размер частиц). У стартового скина кольцо — цвета лиги.
 */
export function skinVars(skinId: string, size: number, leagueColor?: string): CSSProperties {
  const style = skinStyle(skinId);
  const base = skinId === DEFAULT_SKIN_ID && leagueColor;
  const league = leagueColor === 'rainbow' ? '#ffc93c' : leagueColor;
  const ringA = base ? league! : style.ring[0];
  const ringB = base ? league! : style.ring[1];
  return {
    ['--glow' as string]: base ? ringA : style.glow,
    ['--glow2' as string]: base ? ringB : style.glow2,
    ['--ring-a' as string]: ringA,
    ['--ring-b' as string]: ringB,
    ['--pt' as string]: `${Math.max(10, Math.round(size * 0.075))}px`,
  };
}
