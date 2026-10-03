import { CARD_GLYPHS, parseCardIcon } from '@meowgul/shared';
import {
  MAX_LEVEL_PRICE,
  MAX_LEVEL_PROFIT,
  cardLevelCost,
  cardLevelProfit,
  type CardConfig,
} from './config/cards.js';
import { LEAGUES } from './config/leagues.js';

export interface BalanceReport {
  errors: string[];
  warnings: string[];
}

/** Окупаемость уровня в часах. */
export function levelPayback(card: CardConfig, level: number): number {
  return cardLevelCost(card, level) / cardLevelProfit(card, level);
}

/**
 * Правила экономики карточек (их же проверяют тесты):
 *  - costMultiplier 1,7–2,2, profitMultiplier 1,05–1,2;
 *  - окупаемость 1-го уровня 3–250 ч (дорогие тиры окупаются дольше), к 10-му уровню (или максимуму) —
 *    от 100 ч, и растёт с каждым уровнем; прирост дохода за уровень ≤ MAX_LEVEL_PROFIT;
 *  - цена любого уровня ≤ MAX_LEVEL_PRICE;
 *  - уникальные id и иконки, условия ссылаются на существующие карточки и не образуют циклов.
 */
export function checkCardsBalance(cards: readonly CardConfig[]): BalanceReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  if (byId.size !== cards.length) errors.push('повторяющиеся id карточек');

  const icons = new Map<string, string>();
  for (const card of cards) {
    const key = card.icon.split('/').slice(0, 2).join('/');
    const other = icons.get(key);
    if (other) errors.push(`${card.id}: такая же иконка, как у ${other} (${key})`);
    icons.set(key, card.id);
    const glyph = card.icon.split('/')[0];
    if (!(CARD_GLYPHS as readonly string[]).includes(glyph ?? ''))
      errors.push(`${card.id}: неизвестный рисунок ${glyph}`);
    if (parseCardIcon(card.icon).badge === 'none' && card.icon.split('/')[1] !== 'none') {
      errors.push(`${card.id}: неизвестный значок в ${card.icon}`);
    }
  }

  for (const card of cards) {
    const id = card.id;
    if (card.costMultiplier < 1.7 || card.costMultiplier > 2.2)
      errors.push(`${id}: costMultiplier вне 1,7–2,2`);
    if (card.profitMultiplier < 1.05 || card.profitMultiplier > 1.2) {
      errors.push(`${id}: profitMultiplier вне 1,05–1,2`);
    }
    const first = levelPayback(card, 1);
    if (first < 3 || first > 250)
      errors.push(`${id}: окупаемость 1-го уровня ${first.toFixed(1)} ч (нужно 3–250)`);
    if (cardLevelProfit(card, card.maxLevel) > MAX_LEVEL_PROFIT)
      errors.push(`${id}: прирост дохода за уровень выше ${MAX_LEVEL_PROFIT}`);
    const late = levelPayback(card, Math.min(10, card.maxLevel));
    if (late < 100)
      errors.push(`${id}: окупаемость ${Math.min(10, card.maxLevel)}-го уровня ${late.toFixed(0)} ч (< 100)`);
    for (let level = 2; level <= card.maxLevel; level++) {
      if (levelPayback(card, level) < levelPayback(card, level - 1)) {
        errors.push(`${id}: окупаемость падает на ${level}-м уровне`);
        break;
      }
    }
    if (cardLevelCost(card, card.maxLevel) > MAX_LEVEL_PRICE)
      errors.push(`${id}: цена максимального уровня слишком велика`);
    if (card.maxLevel < 10) warnings.push(`${id}: всего ${card.maxLevel} уровней`);

    const cond = card.condition;
    if (cond?.type === 'card') {
      const target = byId.get(cond.cardId);
      if (!target) errors.push(`${id}: условие ссылается на несуществующую карточку ${cond.cardId}`);
      else if (cond.level > target.maxLevel)
        errors.push(`${id}: условие требует уровень выше максимума ${cond.cardId}`);
      if (target?.isLimited) errors.push(`${id}: условие на лимитированную карточку ${cond.cardId}`);
    }
    if (cond?.type === 'league' && !LEAGUES[cond.level]) errors.push(`${id}: условие на несуществующую лигу`);
  }

  // циклы в дереве прокачки
  for (const card of cards) {
    const seen = new Set<string>();
    let current: CardConfig | undefined = card;
    while (current?.condition?.type === 'card') {
      if (seen.has(current.id)) {
        errors.push(`${card.id}: цикл в условиях открытия`);
        break;
      }
      seen.add(current.id);
      current = byId.get(current.condition.cardId);
    }
  }
  return { errors, warnings };
}
