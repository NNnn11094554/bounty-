import { COSMETICS } from '@meowgul/shared';
import { describe, expect, it } from 'vitest';
import { heroLayout } from '../components/hero/layout';
import { heroAsset, SKIN_STYLES } from './skins';

describe('hero skins', () => {
  const skins = COSMETICS.filter((c) => c.kind === 'skin')
    .map((c) => c.id)
    .sort();

  it('every catalog skin has colours and a recolor recipe for the build', async () => {
    expect(Object.keys(SKIN_STYLES).sort()).toEqual(skins);
    // рецепты перекраски живут в скрипте сборки картинок (node), путь — от папки frontend
    const url = `file://${process.cwd()}/scripts/hero/recolor.mjs`;
    const { SKIN_RECOLORS } = (await import(/* @vite-ignore */ url)) as {
      SKIN_RECOLORS: Record<string, unknown>;
    };
    expect(Object.keys(SKIN_RECOLORS).sort()).toEqual(skins);
  });

  it('an unknown skin falls back to the base images', () => {
    expect(heroAsset('nope', 'body')).toBe('/assets/generated/hero/black_crown-body.webp');
    expect(heroAsset('queen', 'tap')).toBe('/assets/generated/hero/queen-tap.webp');
  });

  it('the cat and the TAP button fit the stage side by side', () => {
    for (const w of [280, 328, 360, 398, 460]) {
      for (const h of [150, 260, 340, 420, 600]) {
        const { cat, tap } = heroLayout(w, h);
        expect(cat.left).toBeGreaterThanOrEqual(-0.5);
        expect(cat.top).toBeGreaterThanOrEqual(-0.5);
        expect(cat.left + cat.width).toBeLessThanOrEqual(tap.left);
        expect(tap.left + tap.width).toBeLessThanOrEqual(w + 0.5);
        expect(tap.top).toBeGreaterThanOrEqual(-0.5);
        expect(tap.top + tap.height).toBeLessThanOrEqual(h + 0.5);
        expect(tap.width).toBeGreaterThanOrEqual(60);
      }
    }
  });
});
