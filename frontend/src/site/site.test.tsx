import { AIRDROP_REQUIREMENTS } from '@meowgul/shared';
import { render } from '@testing-library/react';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { webpSize } from '../test/images';
import assets from './catAssets.json';
import { CAT_SIZES, CATS, HERO_CAT, catArt, catAsset, catIcon, catSize } from './cats';
import { AIRDROP_REQS, GAME_FACTS, LEAGUES, STATIONS } from './content';
import { demoEnergy, demoTap, leagueIndex, refillEnergy, startTurbo, useDemo } from './demo';
import { nearness, travel } from './timeline';
import { Title } from './ui/Title';

const PUBLIC = path.resolve(__dirname, '..', '..', 'public');

describe('site cats ↔ art', () => {
  it('every cat has its geometry and all files in every size (AVIF + WebP), nothing extra on disk', () => {
    expect(CATS.map((c) => c.id).sort()).toEqual([...assets.ids].sort());
    expect(readdirSync(path.join(PUBLIC, 'assets', 'site', 'cats')).sort()).toEqual([...assets.ids].sort());
    for (const { id } of CATS) {
      expect(() => catArt(id)).not.toThrow();
      for (const file of ['character', 'background'] as const) {
        for (const size of CAT_SIZES[file]) {
          for (const format of ['avif', 'webp'] as const) {
            const f = path.join(PUBLIC, catAsset(id, file, size, format));
            expect(statSync(f).size, f).toBeGreaterThan(2_000);
            expect(statSync(f).size, f).toBeLessThan(700_000);
          }
        }
      }
      expect(existsSync(path.join(PUBLIC, catIcon(id)))).toBe(true);
    }
  });

  it('files have the pixels their name promises: nothing was upscaled to fill the size', () => {
    for (const { id } of CATS) {
      for (const file of ['character', 'background'] as const) {
        for (const size of CAT_SIZES[file]) {
          const { width, height } = webpSize(path.join(PUBLIC, catAsset(id, file, size, 'webp')));
          expect(
            Math.abs((file === 'character' ? height : width) - size),
            `${id}/${file}-${size}`,
          ).toBeLessThanOrEqual(1);
          if (file === 'character') expect(width / height).toBeCloseTo(catArt(id).aspect, 2);
          if (file === 'background') expect(width / height).toBeCloseTo(catArt(id).scene.aspect, 2);
        }
      }
    }
  });

  it('size picking: the smallest file that covers the screen pixels, never a stretched one', () => {
    expect(catSize('character', 400, 2)).toBe(900);
    expect(catSize('character', 560, 2)).toBe(1200);
    expect(catSize('character', 700, 2)).toBe(1600);
    // экран больше самого крупного файла — берётся самый крупный, не выдуманный размер
    expect(catSize('character', 1400, 3)).toBe(1600);
    expect(catSize('background', 900, 2)).toBe(1800);
  });

  it('cats are distinct characters: own colours and world', () => {
    expect(new Set(CATS.map((c) => c.accent)).size).toBe(CATS.length);
    expect(new Set(CATS.map((c) => c.world)).size).toBe(CATS.length);
    expect(HERO_CAT.id).toBe('inferno');
  });
});

describe('site content', () => {
  it('stations and game numbers match the game', () => {
    expect(STATIONS).toEqual(['home', 'game', 'collection', 'upgrades', 'earn', 'airdrop']);
    expect(AIRDROP_REQS.map((r) => r.id)).toEqual([...AIRDROP_REQUIREMENTS]);
    expect(LEAGUES).toHaveLength(GAME_FACTS.leagues);
    for (let i = 1; i < LEAGUES.length; i++)
      expect(LEAGUES[i]!.threshold).toBeGreaterThan(LEAGUES[i - 1]!.threshold);
    expect(leagueIndex(0)).toBe(0);
    expect(leagueIndex(1_240_000)).toBe(2);
  });
});

describe('camera timeline', () => {
  it('the camera holds at a station and travels smoothly between them', () => {
    expect(travel(0)).toBe(0);
    expect(travel(1)).toBe(1);
    expect(travel(0.1)).toBe(0);
    expect(travel(0.9)).toBe(1);
    expect(travel(0.5)).toBeCloseTo(0.5, 5);
    let prev = 0;
    for (let f = 0; f <= 1; f += 0.01) {
      const t = travel(f);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('panels appear only near their station', () => {
    expect(nearness(2, 2)).toBe(1);
    expect(nearness(2.05, 2)).toBe(1);
    expect(nearness(2.5, 2)).toBe(0);
    expect(nearness(1.7, 2)).toBeGreaterThan(0);
    expect(nearness(1.7, 2)).toBeLessThan(1);
  });
});

describe('demo game', () => {
  it('tap spends energy and pays; Turbo pays ×5 without energy; full energy refills', () => {
    const before = demoEnergy();
    expect(demoTap()).toBe(1);
    expect(demoEnergy()).toBeLessThan(before);
    expect(useDemo.getState().taps).toBe(1);
    expect(startTurbo()).toBe(true);
    expect(startTurbo()).toBe(false);
    const energy = demoEnergy();
    expect(demoTap()).toBe(GAME_FACTS.turbo.multiplier);
    expect(demoEnergy()).toBeGreaterThanOrEqual(energy);
    expect(refillEnergy()).toBe(true);
    expect(demoEnergy()).toBe(GAME_FACTS.energy.max);
    expect(useDemo.getState().fullLeft).toBe(GAME_FACTS.fullEnergy.perDay - 1);
  });
});

describe('titles', () => {
  it('words never break inside: each word is one unbreakable piece, letters keep their order', () => {
    const { container } = render(<Title text="Кристальный принц" letters />);
    const h2 = container.querySelector('h2')!;
    expect(h2.getAttribute('aria-label')).toBe('Кристальный принц');
    expect(h2.style.getPropertyValue('--chars')).toBe('11');
    const words = container.querySelectorAll('.word');
    expect(words).toHaveLength(2);
    expect(words[0]!.textContent).toBe('Кристальный');
    const letters = container.querySelectorAll<HTMLElement>('.letter');
    expect(letters).toHaveLength(16);
    expect(letters[11]!.style.getPropertyValue('--k')).toBe('11');
  });
});
