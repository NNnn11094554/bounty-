/**
 * Уровень игрока (1…50) — по монетам, заработанным за всё время (то же число, что двигает лиги).
 * Уровни не дают монет и не меняют экономику: открывают скины и эффекты в коллекции.
 * Порог уровня L: 2 500 × (L − 1)^3,2 (уровень 3 ≈ 23 тыс., 10 ≈ 2,8 млн, 30 ≈ 120 млн).
 */
export const MAX_LEVEL = 50;

export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round((2500 * (level - 1) ** 3.2) / 100) * 100;
}

export interface LevelInfo {
  level: number;
  /** заработано с начала текущего уровня */
  current: number;
  /** нужно заработать на этом уровне до следующего (0 — максимальный) */
  span: number;
  /** 0…1 */
  progress: number;
}

export function playerLevel(totalEarned: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && totalEarned >= levelThreshold(level + 1)) level++;
  const from = levelThreshold(level);
  const span = level >= MAX_LEVEL ? 0 : levelThreshold(level + 1) - from;
  const current = Math.max(0, totalEarned - from);
  return { level, current, span, progress: span ? Math.min(1, current / span) : 1 };
}
