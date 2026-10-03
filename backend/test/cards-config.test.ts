import { ACHIEVEMENTS, CARD_CATEGORIES, CARD_RARITIES, parseCardIcon } from '@meowgul/shared';
import { describe, expect, it } from 'vitest';
import { checkCardsBalance, levelPayback } from '../src/game/cardsBalance.js';
import {
  ASSET_UNLOCK,
  CARDS,
  LIMITED_CARD_IDS,
  assignStarsPrices,
  cardLevelCost,
  cardLevelProfit,
  cardTotalCost,
  cardTotalProfit,
  paybackHours,
} from '../src/game/config/cards.js';
import { LEGACY_CARD_IDS } from '../src/game/config/legacyCards.js';
import { AIRDROP_TARGETS } from '../src/routes/airdrop.js';
import { conditionFromRow, conditionToRow } from '../src/services/cards.js';

const FORBIDDEN = /hamster|хомяк|bybit|binance|okx|bounty/i;

describe('crypto assets config', () => {
  it('has 60+ assets in four categories, the requested coins among them, and 10 limited events', () => {
    const regular = CARDS.filter((c) => !c.isLimited);
    expect(regular.length).toBeGreaterThanOrEqual(55);
    for (const category of CARD_CATEGORIES) {
      expect(regular.filter((c) => c.category === category).length).toBeGreaterThanOrEqual(12);
    }
    const tickers = new Set(CARDS.map((c) => parseCardIcon(c.icon).ticker));
    for (const t of ['SOL', 'BNB', 'ETH', 'TON', 'BTC', 'XRP', 'DOGE', 'ADA', 'AVAX'])
      expect(tickers.has(t)).toBe(true);
    const limited = CARDS.filter((c) => c.isLimited);
    expect(limited).toHaveLength(10);
    expect(limited.every((c) => c.category === 'SPECIALS')).toBe(true);
    expect(LIMITED_CARD_IDS).toEqual(limited.map((c) => c.id));
    // ни один новый id не совпадает со старыми карточками (их удаляет миграция)
    for (const c of CARDS) expect(LEGACY_CARD_IDS).not.toContain(c.id);
  });

  it('every asset has a rarity that grows with its tier (price)', () => {
    const rank = (c: (typeof CARDS)[number]) => CARD_RARITIES.indexOf(c.rarity);
    for (const c of CARDS) expect(rank(c)).toBeGreaterThanOrEqual(0);
    const sorted = [...CARDS].sort((a, b) => a.baseCost - b.baseCost);
    for (let i = 1; i < sorted.length; i++)
      expect(rank(sorted[i]!)).toBeGreaterThanOrEqual(rank(sorted[i - 1]!));
    expect(new Set(CARDS.map((c) => c.rarity)).size).toBe(CARD_RARITIES.length);
  });

  it('the cheapest assets are free (coins), the rest cost Stars in the same cheap → expensive order', () => {
    const sorted = [...CARDS].sort((a, b) => a.baseCost - b.baseCost);
    const free = sorted.slice(0, ASSET_UNLOCK.free);
    expect(free.every((c) => c.starsPrice === null)).toBe(true);
    expect(CARDS.filter((c) => c.starsPrice === null)).toHaveLength(ASSET_UNLOCK.free);
    const paid = sorted.slice(ASSET_UNLOCK.free);
    expect(paid[0]!.starsPrice).toBe(ASSET_UNLOCK.minStars);
    expect(paid.at(-1)!.starsPrice).toBe(ASSET_UNLOCK.maxStars);
    for (let i = 1; i < paid.length; i++)
      expect(paid[i]!.starsPrice!).toBeGreaterThan(paid[i - 1]!.starsPrice!);
    // бесплатные — из разных категорий: комбо дня собирается без покупок за Stars
    expect(new Set(free.map((c) => c.category)).size).toBeGreaterThanOrEqual(3);
  });

  it('asset goals are reachable: achievements within the catalog, the airdrop needs only coin assets', () => {
    for (const a of ACHIEVEMENTS.filter((x) => x.metric === 'cards')) {
      expect(a.threshold, a.id).toBeLessThanOrEqual(CARDS.length);
    }
    for (const a of ACHIEVEMENTS.filter((x) => x.metric === 'cardMaxLevel')) {
      expect(a.threshold, a.id).toBeLessThanOrEqual(Math.max(...CARDS.map((c) => c.maxLevel)));
    }
    // требование Airdrop выполнимо бесплатно
    expect(AIRDROP_TARGETS.cards).toBeLessThanOrEqual(ASSET_UNLOCK.free);
  });

  it('assignStarsPrices follows the config: nice numbers, strictly growing, any number of free assets', () => {
    const cards = CARDS.filter((c) => !c.isLimited);
    const priced = assignStarsPrices(cards, { free: 2, minStars: 10, maxStars: 500 });
    expect(priced.filter((c) => c.starsPrice === null)).toHaveLength(2);
    const stars = priced
      .filter((c) => c.starsPrice !== null)
      .sort((a, b) => a.baseCost - b.baseCost)
      .map((c) => c.starsPrice!);
    expect(stars[0]).toBe(10);
    expect(stars.at(-1)).toBe(500);
    for (const s of stars.filter((x) => x >= 100 && x < 500)) expect(s % 10).toBe(0);
  });

  it('passes the economy rules of balance-check', () => {
    const report = checkCardsBalance(CARDS);
    expect(report.errors).toEqual([]);
  });

  it('payback grows smoothly from hours (cheap tiers) to years (last levels); ≤ 2M/h per level', () => {
    for (const card of CARDS) {
      expect(levelPayback(card, 1)).toBeGreaterThanOrEqual(3);
      expect(levelPayback(card, 1)).toBeLessThanOrEqual(300);
      expect(levelPayback(card, card.maxLevel)).toBeGreaterThanOrEqual(levelPayback(card, 1) * 15);
      expect(levelPayback(card, card.maxLevel)).toBeLessThanOrEqual(80_000);
      // длинные карточки (20–25 уровней) — цели на месяцы: последний уровень дольше 1 000 ч
      if (card.maxLevel >= 20) expect(levelPayback(card, card.maxLevel)).toBeGreaterThanOrEqual(1_000);
      // без «стен»: соседние уровни окупаются не больше чем в 1,6 раза дольше
      for (let level = 2; level <= card.maxLevel; level++)
        expect(levelPayback(card, level) / levelPayback(card, level - 1)).toBeLessThan(1.6);
    }
    // ни один уровень ни одной карточки не даёт больше 2 млн/ч (раньше доходило до 30 млн)
    for (const card of CARDS)
      for (let level = 1; level <= card.maxLevel; level++)
        expect(cardLevelProfit(card, level)).toBeLessThanOrEqual(2_000_000);
  });

  it('uses the documented formulas (payback_time = upgrade_cost / additional_profit_per_hour)', () => {
    const card = { baseCost: 1000, costMultiplier: 1.8, baseProfit: 200, profitMultiplier: 1.12 };
    expect(cardLevelCost(card, 1)).toBe(1000);
    expect(cardLevelCost(card, 3)).toBe(Math.round(1000 * 1.8 ** 2));
    expect(cardLevelProfit(card, 1)).toBe(200);
    expect(cardLevelProfit(card, 4)).toBe(Math.round(200 * 1.12 ** 3));
    expect(cardTotalProfit(card, 0)).toBe(0);
    expect(cardTotalProfit(card, 3)).toBe(200 + 224 + 251);
    expect(cardTotalCost(card, 2)).toBe(1000 + 1800);
    const btc = CARDS.find((c) => c.id === 'btc')!;
    expect(paybackHours(btc, 5)).toBeCloseTo(cardLevelCost(btc, 5) / cardLevelProfit(btc, 5), 9);
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

  it('every icon is our own coin with a unique ticker or a known glyph with a unique glyph+badge pair', () => {
    const pairs = new Set<string>();
    for (const c of CARDS) {
      const spec = parseCardIcon(c.icon);
      expect(c.icon.startsWith(`${spec.glyph}/`)).toBe(true);
      const pair = spec.glyph === 'token' ? `token/${spec.ticker}` : `${spec.glyph}/${spec.badge}`;
      expect(spec.ticker).not.toBe('?');
      expect(pairs.has(pair)).toBe(false);
      pairs.add(pair);
    }
    // токены — это монеты; события и инфраструктура — рисунки
    expect(CARDS.filter((c) => c.category !== 'SPECIALS').every((c) => c.icon.startsWith('token/'))).toBe(
      true,
    );
  });

  it('cooldowns are between 10 minutes and 24 hours', () => {
    for (const c of CARDS.filter((card) => card.cooldownSec > 0)) {
      expect(c.cooldownSec).toBeGreaterThanOrEqual(600);
      expect(c.cooldownSec).toBeLessThanOrEqual(86_400);
    }
    expect(CARDS.filter((c) => c.cooldownSec > 0).length).toBeGreaterThanOrEqual(12);
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
