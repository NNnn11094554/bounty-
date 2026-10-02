/**
 * Проверка баланса карточек: npm run balance-check
 * Печатает окупаемость (цена уровня / прирост прибыли в час) по всем карточкам до 25 уровня
 * и проверяет правила экономики. Код выхода 1 — есть нарушения.
 *   --full    — таблица по каждой карточке (иначе — сводка по тирам и ключевые уровни)
 *   --card=ID — подробная таблица одной карточки
 */
import { formatShort } from '@meowgul/shared';
import { CARDS, cardLevelCost, cardLevelProfit, type CardConfig } from '../game/config/cards.js';
import { checkCardsBalance } from '../game/cardsBalance.js';

const LEVELS = [1, 2, 3, 5, 7, 9, 10, 12, 15, 20, 25];

function payback(card: CardConfig, level: number): number | null {
  if (level > card.maxLevel) return null;
  return cardLevelCost(card, level) / cardLevelProfit(card, level);
}

// вывод в `head` и т.п.: закрытый канал — не ошибка
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

function hours(h: number | null): string {
  if (h === null) return '—';
  if (h < 100) return `${h.toFixed(1).replace('.', ',')}ч`;
  return `${formatShort(Math.round(h), 'ru')}ч`;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function printCard(card: CardConfig): void {
  console.log(`\n${card.id} — ${card.nameRu} (${card.category}, maxLevel ${card.maxLevel})`);
  console.log(`  ${pad('ур.', 4)}${pad('цена', 12)}${pad('+прибыль/ч', 12)}окупаемость`);
  for (let level = 1; level <= card.maxLevel; level++) {
    console.log(
      `  ${pad(String(level), 4)}${pad(formatShort(cardLevelCost(card, level), 'ru'), 12)}` +
        `${pad(formatShort(cardLevelProfit(card, level), 'ru'), 12)}${hours(payback(card, level))}`,
    );
  }
}

function main(): void {
  const only = process.argv.find((a) => a.startsWith('--card='))?.slice('--card='.length);
  if (only) {
    const card = CARDS.find((c) => c.id === only);
    if (!card) {
      console.error(`Card ${only} not found`);
      process.exitCode = 1;
      return;
    }
    printCard(card);
    return;
  }

  const full = process.argv.includes('--full');
  console.log(`Карточек: ${CARDS.length} (лимитированных: ${CARDS.filter((c) => c.isLimited).length})`);
  console.log('Окупаемость уровня = цена уровня / прирост прибыли в час, часы.\n');
  console.log(pad('карточка', 22) + pad('цена 1', 9) + LEVELS.map((l) => pad(`ур.${l}`, 9)).join(''));
  for (const card of CARDS) {
    console.log(
      pad(card.id, 22) +
        pad(formatShort(card.baseCost, 'ru'), 9) +
        LEVELS.map((l) => pad(hours(payback(card, l)), 9)).join(''),
    );
    if (full) printCard(card);
  }

  const { errors, warnings } = checkCardsBalance(CARDS);
  for (const w of warnings) console.warn(`ВНИМАНИЕ: ${w}`);
  for (const e of errors) console.error(`ОШИБКА: ${e}`);
  console.log(`\nИтог: ошибок ${errors.length}, предупреждений ${warnings.length}.`);
  if (errors.length > 0) process.exitCode = 1;
}

main();
