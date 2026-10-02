import { COSMETICS } from '@meowgul/shared';
import { describe, expect, it } from 'vitest';
import { heroLayout } from '../components/hero/layout';
import { CAT_RIGS, heroAsset, SKIN_STYLES } from './skins';

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
    expect(heroAsset('queen', 'head')).toBe('/assets/generated/hero/queen-head.webp');
  });

  it('the cat fits the stage, stands on its bottom edge, a bit left of centre; the tap zone covers it', () => {
    const { aspect } = CAT_RIGS.street;
    for (const w of [280, 328, 360, 398, 460]) {
      for (const h of [120, 260, 340, 420, 600]) {
        const { cat, hit } = heroLayout(w, h, aspect);
        expect(cat.left).toBeGreaterThanOrEqual(0);
        expect(cat.left + cat.width).toBeLessThanOrEqual(w + 0.01);
        expect(cat.top).toBeGreaterThanOrEqual(-0.01);
        expect(cat.top + cat.height).toBeCloseTo(h, 5);
        // хвост слева — рамка кота чуть левее середины, сам кот на глаз по центру
        const centre = cat.left + cat.width / 2;
        expect(centre).toBeLessThan(w / 2);
        expect(centre).toBeGreaterThan(w / 2 - cat.width * 0.1);
        expect(hit.left).toBeGreaterThanOrEqual(0);
        expect(hit.left + hit.width).toBeLessThanOrEqual(w + 0.01);
        expect(hit.left).toBeLessThanOrEqual(cat.left + 0.01);
        expect(hit.left + hit.width).toBeGreaterThanOrEqual(cat.left + cat.width - 0.01);
      }
    }
  });

  it('every skin uses a known rig', () => {
    for (const id of skins) expect(CAT_RIGS[SKIN_STYLES[id]!.rig]).toBeDefined();
  });
});
