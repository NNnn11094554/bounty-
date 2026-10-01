import { CARD_CATEGORIES, parseCardIcon } from '@meowgul/shared';
import { describe, expect, it } from 'vitest';
import { checkCardsBalance, levelPayback } from '../src/game/cardsBalance.js';
import {
  CARDS,
  LIMITED_CARD_IDS,
  cardLevelCost,
  cardLevelProfit,
  cardTotalProfit,
} from '../src/game/config/cards.js';
import { conditionFromRow, conditionToRow } from '../src/services/cards.js';

const FORBIDDEN = /hamster|хомяк|bybit|binance|okx/i;

describe('cards config', () => {
  it('has 120+ regular cards (~30 per category) and 15 limited specials', () => {
    const regular = CARDS.filter((c) => !c.isLimited);
    expect(regular.length).toBeGreaterThanOrEqual(120);
    for (const category of CARD_CATEGORIES) {
      expect(regular.filter((c) => c.category === category).length).toBeGreaterThanOrEqual(28);
    }
    const limited = CARDS.filter((c) => c.isLimited);
    expect(limited).toHaveLength(15);
    expect(limited.every((c) => c.category === 'SPECIALS')).toBe(true);
    expect(LIMITED_CARD_IDS).toEqual(limited.map((c) => c.id));
  });

  it('passes the economy rules of balance-check', () => {
    const report = checkCardsBalance(CARDS);
    expect(report.errors).toEqual([]);
  });

  it('payback grows from ~5 h to 100+ h by level 10', () => {
    for (const card of CARDS) {
      expect(levelPayback(card, 1)).toBeGreaterThanOrEqual(3);
      expect(levelPayback(card, 1)).toBeLessThanOrEqual(12);
      expect(levelPayback(card, Math.min(10, card.maxLevel))).toBeGreaterThanOrEqual(100);
    }
  });

  it('uses the documented formulas', () => {
    const card = { baseCost: 1000, costMultiplier: 1.8, baseProfit: 200, profitMultiplier: 1.12 };
    expect(cardLevelCost(card, 1)).toBe(1000);
    expect(cardLevelCost(card, 3)).toBe(Math.round(1000 * 1.8 ** 2));
    expect(cardLevelProfit(card, 1)).toBe(200);
    expect(cardLevelProfit(card, 4)).toBe(Math.round(200 * 1.12 ** 3));
    expect(cardTotalProfit(card, 0)).toBe(0);
    expect(cardTotalProfit(card, 3)).toBe(200 + 224 + 251);
  });

  it('has original names and descriptions in RU and EN without real brands', () => {
    const names = new Set<string>();
    for (const c of CARDS) {
      for (const text of [c.nameRu, c.nameEn, c.descRu, c.descEn]) {
        expect(text.trim().length).toBeGreaterThan(1);
        expect(text).not.toMatch(FORBIDDEN);
      }
      expect(names.has(c.nameRu)).toBe(false);
      names.add(c.nameRu);
    }
  });

  it('every icon is a known glyph with a unique glyph+badge pair', () => {
    const pairs = new Set<string>();
    for (const c of CARDS) {
      const spec = parseCardIcon(c.icon);
      expect(c.icon.startsWith(`${spec.glyph}/`)).toBe(true);
      const pair = `${spec.glyph}/${spec.badge}`;
      expect(pairs.has(pair)).toBe(false);
      pairs.add(pair);
    }
  });

  it('cooldowns are between 10 minutes and 24 hours', () => {
    for (const c of CARDS.filter((card) => card.cooldownSec > 0)) {
      expect(c.cooldownSec).toBeGreaterThanOrEqual(600);
      expect(c.cooldownSec).toBeLessThanOrEqual(86_400);
    }
    expect(CARDS.filter((c) => c.cooldownSec > 0).length).toBeGreaterThan(20);
  });

  it('serialises conditions for the database and back', () => {
    for (const c of CARDS) {
      const row = conditionToRow(c.condition);
      expect(conditionFromRow(row.conditionType, row.conditionValue)).toEqual(c.condition);
    }
    expect(conditionFromRow('card', 'broken')).toBeNull();
    expect(conditionFromRow('friends', '-1')).toBeNull();
    expect(conditionFromRow('unknown', '1')).toBeNull();
  });
});
