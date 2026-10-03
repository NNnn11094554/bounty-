import { CARD_GLYPHS, TICKER_RE, parseCardIcon } from '@meowgul/shared';
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
 * Правила экономики активов (их же проверяют тесты):
 *  - costMultiplier 1,1–2,2, profitMultiplier 1,05–1,25;
 *  - окупаемость 1-го уровня 3–300 ч (дорогие тиры окупаются дольше), последнего — до 80 000 ч и не
 *    меньше чем в 15 раз дольше первого; растёт с каждым уровнем (без «стен» и без провалов);
 *  - прирост дохода за уровень ≤ MAX_LEVEL_PROFIT;
 *  - цена любого уровня ≤ MAX_LEVEL_PRICE;
 *  - уникальные id и иконки (у монет — тикеры), условия ссылаются на существующие активы и не образуют циклов;
 *  - цена в Stars — целое 1–10 000; бесплатные активы не дороже платных, а цены в Stars идут в том же
 *    порядке, что и цены 1-го уровня в монетах (дороже в монетах — не дешевле в Stars).
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
    const [glyph, mark] = card.icon.split('/');
    if (!(CARD_GLYPHS as readonly string[]).includes(glyph ?? ''))
      errors.push(`${card.id}: неизвестный рисунок ${glyph}`);
    if (glyph === 'token') {
      if (!TICKER_RE.test(mark ?? '')) errors.push(`${card.id}: тикер монеты должен быть 2–6 букв A–Z/цифр`);
    } else if (parseCardIcon(card.icon).badge === 'none' && mark !== 'none') {
      errors.push(`${card.id}: неизвестный значок в ${card.icon}`);
    }
  }

  // цены в Stars: от дешёвого к дорогому, бесплатные — самые дешёвые
  const byCost = [...cards].sort((a, b) => a.baseCost - b.baseCost);
  let maxFreeCost = -Infinity;
  for (const card of byCost) if (card.starsPrice === null) maxFreeCost = Math.max(maxFreeCost, card.baseCost);
  let prevStars = 0;
  let prevCost = 0;
  for (const card of byCost) {
    const stars = card.starsPrice;
    if (stars === null) continue;
    if (!Number.isInteger(stars) || stars < 1 || stars > 10_000)
      errors.push(`${card.id}: цена в Stars должна быть целым числом 1–10 000`);
    if (card.baseCost < maxFreeCost)
      errors.push(`${card.id}: платный актив дешевле бесплатного — бесплатными должны быть самые дешёвые`);
    if (stars < prevStars && card.baseCost > prevCost)
      errors.push(`${card.id}: дороже в монетах, но дешевле в Stars (${stars} < ${prevStars})`);
    prevStars = Math.max(prevStars, stars);
    prevCost = card.baseCost;
  }

  for (const card of cards) {
    const id = card.id;
    if (card.costMultiplier < 1.1 || card.costMultiplier > 2.2)
      errors.push(`${id}: costMultiplier вне 1,1–2,2`);
    if (card.profitMultiplier < 1.05 || card.profitMultiplier > 1.25) {
      errors.push(`${id}: profitMultiplier вне 1,05–1,25`);
    }
    const first = levelPayback(card, 1);
    if (first < 3 || first > 300)
      errors.push(`${id}: окупаемость 1-го уровня ${first.toFixed(1)} ч (нужно 3–300)`);
    if (cardLevelProfit(card, card.maxLevel) > MAX_LEVEL_PROFIT)
      errors.push(`${id}: прирост дохода за уровень выше ${MAX_LEVEL_PROFIT}`);
    const last = levelPayback(card, card.maxLevel);
    if (last > 80_000) errors.push(`${id}: окупаемость последнего уровня ${last.toFixed(0)} ч (> 80 000)`);
    if (last < first * 15)
      errors.push(
        `${id}: последний уровень окупается всего в ${(last / first).toFixed(0)} раз дольше первого`,
      );
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
