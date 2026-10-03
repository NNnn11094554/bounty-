import { MAX_LEVEL, playerLevel } from '@meowgul/shared';
import { CARDS } from './config/cards.js';
import { LEAGUES, leagueForTotal } from './config/leagues.js';

/**
 * Общий прогресс игры (0…1) — по нему балансируется экономика.
 *  - 60% — прокачка карточек: доля купленных уровней от всех уровней всех карточек;
 *  - 20% — лига (по всего заработанному);
 *  - 20% — уровень игрока (по всего заработанному).
 * Ориентир: Early 0–20%, Mid 20–50%, Advanced 50–70%, Late 70–80%, End game 80–100%.
 */
export const PROGRESS_WEIGHTS = { cards: 0.6, league: 0.2, level: 0.2 } as const;

const TOTAL_CARD_LEVELS = CARDS.reduce((sum, c) => sum + c.maxLevel, 0);

export interface ProgressParts {
  cards: number;
  league: number;
  level: number;
  total: number;
}

export function overallProgress(cardLevels: ReadonlyMap<string, number>, totalEarned: number): ProgressParts {
  let levels = 0;
  for (const c of CARDS) levels += Math.min(c.maxLevel, cardLevels.get(c.id) ?? 0);
  const cards = levels / TOTAL_CARD_LEVELS;
  const league = leagueForTotal(totalEarned) / (LEAGUES.length - 1);
  const level = (playerLevel(totalEarned).level - 1) / (MAX_LEVEL - 1);
  const total =
    PROGRESS_WEIGHTS.cards * cards + PROGRESS_WEIGHTS.league * league + PROGRESS_WEIGHTS.level * level;
  return { cards, league, level, total };
}
