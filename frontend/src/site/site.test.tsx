import { AIRDROP_REQUIREMENTS } from '@meowgul/shared';
import { render } from '@testing-library/react';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { webpSize } from '../test/images';
import assets from './catAssets.json';
import { CAT_SIZES, CATS, HERO_CAT, STRONGEST_CAT, catArt, catAsset, catIcon, catSize } from './cats';
import { AIRDROP_REQS, GAME_FACTS, LEAGUES, NAV, ROADMAP, SECTIONS, WORLDS } from './content';
import { LOCALES, detectLocale, fmt, type Dict } from './i18n';
import { de } from './i18n/de';
import { en } from './i18n/en';
import { es } from './i18n/es';
import { fr } from './i18n/fr';
import { ja } from './i18n/ja';
import { ko } from './i18n/ko';
import { pt } from './i18n/pt';
import { ru } from './i18n/ru';
import { uk } from './i18n/uk';
import { zh } from './i18n/zh';

/** Все словари (на сайте они грузятся по требованию). */
const DICTS: Array<{ code: string; dict: Dict }> = Object.entries({
  en,
  ru,
  uk,
  zh,
  ja,
  ko,
  es,
  pt,
  fr,
  de,
}).map(([code, dict]) => ({ code, dict }));
import { demoEnergy, demoTap, leagueIndex, refillEnergy, startTurbo, useDemo } from './demo';
import { holdSpans, nearness, stationAt, travel } from './timeline';
import { headingParts } from './ui/headings';
import { Words } from './ui/Section';
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

  it('every cat has lore in every language and its own idle life (different sets, small amplitudes)', () => {
    for (const c of CATS) {
      for (const { code, dict } of DICTS) {
        const text = dict.cats[c.id as keyof Dict['cats']];
        expect(text, `${code}/${c.id}`).toBeDefined();
        expect(text.subtitle.length, `${code}/${c.id}`).toBeGreaterThan(1);
        expect(text.story.length, `${code}/${c.id}`).toBeLessThan(150);
      }
      expect(c.power).toBeGreaterThan(0);
      expect(c.power).toBeLessThanOrEqual(100);
      for (const v of [c.idle.breath, c.idle.tail, c.idle.ears, c.idle.head, c.idle.shoulders])
        expect(v).toBeLessThanOrEqual(1.5);
      expect(catArt(c.id).face.tail, c.id).not.toBeNull();
    }
    expect(Object.keys(en.cats).sort()).toEqual(CATS.map((c) => c.id).sort());
    const sets = new Set(CATS.map((c) => JSON.stringify(c.idle)));
    expect(sets.size).toBe(CATS.length);
  });

  it('cats are distinct characters: own colours and world', () => {
    expect(new Set(CATS.map((c) => c.accent)).size).toBe(CATS.length);
    expect(new Set(Object.values(en.cats).map((c) => c.world)).size).toBe(CATS.length);
    expect(HERO_CAT.id).toBe('inferno');
    // финал — самый сильный персонаж
    expect(Math.max(...CATS.map((c) => c.power))).toBe(STRONGEST_CAT.power);
  });

  it('the game characters from the brief are on the site with their exact lore', () => {
    const cat = (id: keyof Dict['cats']) => ({ ...CATS.find((c) => c.id === id)!, ...en.cats[id] });
    expect(cat('stealth_assassin')).toMatchObject({
      name: 'Stealth Assassin',
      rarity: 'LEGENDARY',
      type: 'Assassin',
      power: 94,
    });
    expect(cat('galaxy_emperor')).toMatchObject({
      name: 'Galaxy Emperor',
      rarity: 'MYTHIC',
      type: 'Cosmic',
      power: 98,
    });
    expect(cat('ocean_guardian')).toMatchObject({
      name: 'Ocean Guardian',
      rarity: 'LEGENDARY',
      type: 'Guardian',
      power: 91,
    });
    expect(cat('cyber_samurai')).toMatchObject({
      name: 'Cyber Samurai',
      rarity: 'LEGENDARY',
      type: 'Warrior',
      power: 95,
    });
  });
});

describe('site content', () => {
  it('stations and game numbers match the game', () => {
    expect(SECTIONS).toEqual([
      'home',
      'world',
      'play',
      'collection',
      'airdrop',
      'roadmap',
      'community',
      'final',
    ]);
    // меню — в порядке страницы
    expect(NAV.map((id) => en.nav[id])).toEqual([
      'Home',
      'World',
      'How to play',
      'Collection',
      'Airdrop',
      'Roadmap',
    ]);
    expect(NAV.map((id) => SECTIONS.indexOf(id))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(AIRDROP_REQS.map((r) => r.id)).toEqual([...AIRDROP_REQUIREMENTS]);
    expect(LEAGUES).toHaveLength(GAME_FACTS.leagues);
    for (let i = 1; i < LEAGUES.length; i++)
      expect(LEAGUES[i]!.threshold).toBeGreaterThan(LEAGUES[i - 1]!.threshold);
    expect(leagueIndex(0)).toBe(0);
    expect(leagueIndex(1_240_000)).toBe(2);
  });
});

describe('honest copy', () => {
  it('no promises of money or wallet connection, future worlds are not presented as live', () => {
    const text = JSON.stringify(en).toLowerCase();
    for (const word of ['guarantee', 'profit', 'allocation', 'connect wallet', 'ton connect'])
      expect(text, word).not.toContain(word);
    for (const { code, dict } of DICTS)
      expect(JSON.stringify(dict).toLowerCase(), code).not.toContain('bounty');
    expect(WORLDS).toHaveLength(4);
    expect(ROADMAP.map((p) => p.state)).toEqual(['done', 'next', 'later', 'unknown']);
    expect(en.community.items).toHaveLength(5);
  });
});

/** Все строки словаря с путями: cats.inferno.name → 'Inferno'. */
const leaves = (o: unknown, path = ''): Array<[string, string]> =>
  typeof o === 'string'
    ? [[path, o]]
    : Object.entries(o as object).flatMap(([key, v]) => leaves(v, path ? `${path}.${key}` : key));

/**
 * Строки, которые в переводе законно совпадают с английскими: числа, названия механик и бренды, имена
 * персонажей и слова, которые в этом языке пишутся так же (Menu, Collection, Expansion…).
 */
const SAME_AS_ENGLISH = new Set([
  '10',
  '50',
  '59',
  '???',
  '5,000',
  'Airdrop',
  'Turbo',
  'Turbo ×{x}',
  'Inferno',
  'Sakura',
  'Toxic',
  'Menu',
  'Compete',
  'Collection',
  'Sections',
  '1 tap',
  'Gameplay',
  'Type',
  'Rare',
  'Assassin',
  'Progression',
  'Phase {n}',
  'Expansion',
  'Roadmap',
  'Community',
  'Telegram Mini App',
  'Assets',
  'Live',
  'Genesis',
  'Events',
]);

describe('languages', () => {
  it('ten languages, each a full translation of the English dictionary', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['en', 'ru', 'uk', 'zh', 'ja', 'ko', 'es', 'pt', 'fr', 'de']);
    expect(DICTS.map((d) => d.code)).toEqual(LOCALES.map((l) => l.code));
    const shape = leaves(en).map(([path]) => path);
    const english = new Map(leaves(en));
    for (const { code, dict } of DICTS) {
      const entries = leaves(dict);
      // та же структура: те же ключи, столько же пунктов в списках
      expect(
        entries.map(([path]) => path),
        code,
      ).toEqual(shape);
      for (const [path, value] of entries) {
        expect(value.trim().length, `${code}: ${path}`).toBeGreaterThan(0);
        // подстановки на месте (порядок в языке может быть другим)
        const vars = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
        expect(vars(value), `${code}: ${path}`).toEqual(vars(english.get(path)!));
        // ничего не забыто на английском
        if (code !== 'en' && value === english.get(path))
          expect(SAME_AS_ENGLISH.has(value), `${code}: ${path} = "${value}"`).toBe(true);
      }
    }
  });

  it('language on first visit: saved choice, then the browser, then English', () => {
    expect(detectLocale('ja', ['de-DE'])).toBe('ja');
    expect(detectLocale(null, ['de-DE', 'en'])).toBe('de');
    expect(detectLocale(null, ['pt-BR'])).toBe('pt');
    expect(detectLocale(null, ['zh-TW'])).toBe('zh');
    expect(detectLocale(null, ['be-BY'])).toBe('ru');
    expect(detectLocale('xx', ['it-IT'])).toBe('en');
    expect(detectLocale(null, [])).toBe('en');
  });

  it('templates and headings without spaces (Chinese, Japanese) still break only between parts', () => {
    expect(fmt('Day {day} of {total}', { day: 4, total: 10 })).toBe('Day 4 of 10');
    expect(headingParts('进入|Meowgul|的世界')).toEqual([
      { text: '进入', space: false },
      { text: 'Meowgul', space: false },
      { text: '的世界', space: false },
    ]);
    expect(headingParts('Enter the world').map((p) => p.space)).toEqual([false, true, true]);
  });
});

describe('camera timeline', () => {
  it('scroll maps to stations: the camera holds while a section fills the screen, flies at the seams', () => {
    // экран 800 px; секции 1200, 800 и 400 px
    const spans = holdSpans(
      [
        { top: 0, height: 1200 },
        { top: 1200, height: 800 },
        { top: 2000, height: 400 },
      ],
      800,
    );
    expect(spans).toEqual([
      [400, 800],
      [1600, 1600],
      [2200, 2200],
    ]);
    expect(stationAt(0, spans)).toBe(0);
    expect(stationAt(800, spans)).toBe(0);
    expect(stationAt(1200, spans)).toBeCloseTo(0.5);
    expect(stationAt(1600, spans)).toBe(1);
    expect(stationAt(1900, spans)).toBeCloseTo(1.5);
    expect(stationAt(9000, spans)).toBe(2);
  });

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
  it('section headings keep words whole and readable for screen readers', () => {
    const { container } = render(<Words text="A world built one cat at a time" />);
    const h2 = container.querySelector('h2')!;
    expect(h2.getAttribute('aria-label')).toBe('A world built one cat at a time');
    expect(h2.textContent).toBe('A world built one cat at a time');
    expect(h2.style.getPropertyValue('--chars')).toBe('5');
    expect(container.querySelectorAll('.w')).toHaveLength(8);
  });

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
