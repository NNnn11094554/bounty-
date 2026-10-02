import type { LeagueInfo } from '@meowgul/shared';

export const LEAGUE_COUNT = 10;

export function leagueAt(leagues: LeagueInfo[], level: number): LeagueInfo {
  return leagues[Math.max(0, Math.min(level, leagues.length - 1))]!;
}

/** Прогресс до следующей лиги по всего заработанному: доля 0..1 и сколько осталось. */
export function leagueProgress(
  leagues: LeagueInfo[],
  level: number,
  totalEarned: number,
): { ratio: number; left: number | null } {
  const current = leagueAt(leagues, level);
  const next = leagues[level + 1];
  if (!next) return { ratio: 1, left: null };
  const span = next.threshold - current.threshold;
  const ratio = Math.min(1, Math.max(0, (totalEarned - current.threshold) / span));
  return { ratio, left: Math.max(0, Math.ceil(next.threshold - totalEarned)) };
}

export function leagueRingColor(league: LeagueInfo): string {
  return league.color;
}
