import type { CardRarity } from '@meowgul/shared';

/** Цвет редкости актива: рамка плитки, камень в углу, плашка в шторке. */
export const RARITY_COLOR: Record<CardRarity, string> = {
  common: '#8aa0c8',
  rare: '#4f9dff',
  epic: '#b06bff',
  legendary: '#ffc93c',
};
