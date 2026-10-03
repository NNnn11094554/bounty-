import { COSMETICS, DEFAULT_SKIN_ID, LEGACY_SKINS } from '@meowgul/shared';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { heroLayout } from '../components/hero/layout';
import art from './skinArt.json';
import {
  liteDevice,
  resetLiteDevice,
  sceneRect,
  skinArt,
  skinAsset,
  skinIcon,
  skinStyle,
  SKIN_STYLES,
} from './skins';

const SKINS = COSMETICS.filter((c) => c.kind === 'skin');
const PUBLIC = path.resolve(__dirname, '..', '..', 'public');

describe('skin catalog ↔ visuals', () => {
  it('every skin in the catalog has a style, art geometry and all its files (AVIF + WebP)', () => {
    expect(Object.keys(SKIN_STYLES).sort()).toEqual(SKINS.map((s) => s.id).sort());
    expect(Object.keys(art).sort()).toEqual(SKINS.map((s) => s.id).sort());
    for (const { id } of SKINS) {
      for (const file of ['character', 'background', 'preview'] as const) {
        for (const format of ['avif', 'webp'] as const) {
          const f = path.join(PUBLIC, skinAsset(id, file, format));
          expect(existsSync(f), f).toBe(true);
          // не пустышка и не гигант: телефону хватает
          expect(statSync(f).size).toBeGreaterThan(2_000);
          expect(statSync(f).size).toBeLessThan(600_000);
        }
      }
      expect(existsSync(path.join(PUBLIC, skinIcon(id)))).toBe(true);
    }
  });

  it('characters are distinct: own colours, scene atmosphere and animation set per skin', () => {
    const accents = new Set(SKINS.map((s) => skinStyle(s.id).accent));
    expect(accents.size).toBeGreaterThanOrEqual(18);
    expect(SKINS.some((s) => (skinStyle(s.id).ambient as string) === 'rain')).toBe(false);
    const combos = new Set(
      SKINS.map((s) => `${skinStyle(s.id).ambient}/${skinStyle(s.id).idle}/${skinStyle(s.id).accent}`),
    );
    expect(combos.size).toBe(SKINS.length);
  });

  it('geometry is sane: proportions of a standing character, head in the top part', () => {
    for (const { id } of SKINS) {
      const a = skinArt(id);
      expect(a.aspect).toBeGreaterThan(0.4);
      expect(a.aspect).toBeLessThan(1.1);
      expect(a.head[1]).toBeLessThan(0.3);
      expect(a.headBottom).toBeGreaterThan(a.head[1]);
      expect(a.body).toBeGreaterThan(0.2);
      expect(a.body).toBeLessThan(0.8);
    }
  });

  it('every character has a face rig: eyes inside the head, the head turns around the neck', () => {
    for (const { id } of SKINS) {
      const { face, head, headBottom } = skinArt(id);
      expect(face.eyes.length, id).toBeGreaterThanOrEqual(1);
      expect(face.eyes.length, id).toBeLessThanOrEqual(2);
      const [hx, hy, hrx, hry] = face.head;
      for (const [x, y, rx, ry] of face.eyes) {
        expect(rx).toBeGreaterThan(0.015);
        expect(ry).toBeGreaterThan(0.015);
        // глаз целиком внутри непрозрачной части головы (до 80% эллипса): при наклоне не двоится
        const far = ((Math.abs(x - hx) + rx) / hrx) ** 2 + (Math.abs(y - hy) / hry) ** 2;
        expect(far, id).toBeLessThan(0.8 ** 2);
        // глаза — в верхней части персонажа, ниже макушки и выше подбородка
        expect(y).toBeGreaterThan(head[1] * 0.8);
        expect(y).toBeLessThan(headBottom);
      }
      expect(face.neck).toEqual([head[0], headBottom]);
    }
  });

  it('unknown and old skin ids fall back to the default character (no old assets are ever requested)', () => {
    expect(skinAsset('nope', 'character')).toBe(`/assets/skins/${DEFAULT_SKIN_ID}/character.webp`);
    for (const old of Object.keys(LEGACY_SKINS)) {
      expect(skinAsset(old, 'background', 'avif')).toBe(`/assets/skins/${DEFAULT_SKIN_ID}/background.avif`);
      expect(skinIcon(old)).toBe(`/assets/skins/${DEFAULT_SKIN_ID}/icon.webp`);
    }
    expect(existsSync(path.join(PUBLIC, 'assets', 'generated', 'hero'))).toBe(false);
  });
});

describe('stage layout', () => {
  it('the character stands on the floor, body centred, tap zone covers it with a margin', () => {
    for (const { id } of SKINS) {
      const { aspect, body } = skinArt(id);
      for (const [w, h] of [
        [358, 420],
        [390, 520],
        [320, 300],
        [430, 640],
      ] as const) {
        const { cat, hit } = heroLayout(w, h, aspect, body);
        expect(cat.top + cat.height).toBeCloseTo(h, 5);
        expect(cat.left).toBeGreaterThanOrEqual(0);
        expect(cat.left + cat.width).toBeLessThanOrEqual(w + 1e-6);
        // центр тела — у середины сцены (если хватает места)
        expect(Math.abs(cat.left + cat.width * body - w / 2)).toBeLessThan(w * 0.12);
        // зона тапа шире персонажа, но в пределах сцены
        expect(hit.width).toBeGreaterThanOrEqual(Math.min(w, cat.width));
        expect(hit.left).toBeGreaterThanOrEqual(0);
        expect(hit.left + hit.width).toBeLessThanOrEqual(w + 1e-6);
        expect(hit.left).toBeLessThanOrEqual(cat.left + cat.width * 0.2);
      }
    }
  });
});

describe('scene alignment', () => {
  it('the character stands exactly on its own spot in its world, and the world covers the whole area', () => {
    // типичные телефоны: дуга главного экрана и рамка персонажа в ней (как считает OfficeScreen)
    const screens = [
      { box: { width: 390, height: 614 }, stage: { top: 140, width: 358, height: 388 } },
      { box: { width: 320, height: 470 }, stage: { top: 110, width: 288, height: 280 } },
      { box: { width: 430, height: 700 }, stage: { top: 150, width: 398, height: 450 } },
    ];
    for (const { id } of SKINS) {
      const art = skinArt(id);
      const [cx, cy, cw, ch] = art.scene.char;
      expect(cx).toBeGreaterThan(0);
      expect(cy).toBeGreaterThan(0);
      expect(cx + cw).toBeLessThan(1);
      expect(cy + ch).toBeLessThan(1);
      for (const { box, stage } of screens) {
        const L = heroLayout(stage.width, stage.height, art.aspect, art.body).cat;
        const fit = { left: 16 + L.left, top: stage.top + L.top, width: L.width, height: L.height };
        const bg = sceneRect(id, fit, box);
        // фон закрывает всю дугу
        expect(bg.left).toBeLessThanOrEqual(0.5);
        expect(bg.top).toBeLessThanOrEqual(0.5);
        expect(bg.left + bg.width).toBeGreaterThanOrEqual(box.width - 0.5);
        expect(bg.top + bg.height).toBeGreaterThanOrEqual(box.height - 0.5);
        // место персонажа на картинке — ровно под ним
        expect(bg.left + cx * bg.width).toBeCloseTo(fit.left, 3);
        expect(bg.top + cy * bg.height).toBeCloseTo(fit.top, 3);
        expect(ch * bg.height).toBeCloseTo(fit.height, 3);
        expect(cw * bg.width).toBeCloseTo(fit.width, 1);
      }
    }
  });
});

describe('weak devices', () => {
  it('few cores, little memory or data saver → light mode', () => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = Object.getOwnPropertyDescriptor(Navigator.prototype, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    Object.defineProperty(nav, 'deviceMemory', { value: 8, configurable: true });
    resetLiteDevice();
    expect(liteDevice()).toBe(false);
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    resetLiteDevice();
    expect(liteDevice()).toBe(true);
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    Object.defineProperty(nav, 'deviceMemory', { value: 2, configurable: true });
    resetLiteDevice();
    expect(liteDevice()).toBe(true);
    if (cores) Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', cores);
    delete (navigator as { hardwareConcurrency?: number }).hardwareConcurrency;
    delete nav.deviceMemory;
    resetLiteDevice();
  });
});
