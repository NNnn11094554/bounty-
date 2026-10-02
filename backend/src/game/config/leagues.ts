/**
 * Лиги — по ВСЕГО заработанным монетам (траты не понижают лигу).
 * Цвета задают оформление вокруг персонажа: обводка, свечение, бейдж.
 */
export interface LeagueConfig {
  level: number;
  id: string;
  name: string;
  threshold: number;
  color: string;
}

export const LEAGUES: readonly LeagueConfig[] = [
  { level: 0, id: 'bronze', name: 'Bronze', threshold: 0, color: '#cd7f32' },
  { level: 1, id: 'silver', name: 'Silver', threshold: 5_000, color: '#c0c7d1' },
  { level: 2, id: 'gold', name: 'Gold', threshold: 25_000, color: '#ffc93c' },
  { level: 3, id: 'platinum', name: 'Platinum', threshold: 100_000, color: '#7fe3ff' },
  { level: 4, id: 'diamond', name: 'Diamond', threshold: 1_000_000, color: '#4f9dff' },
  { level: 5, id: 'epic', name: 'Epic', threshold: 2_000_000, color: '#a66bff' },
  { level: 6, id: 'legendary', name: 'Legendary', threshold: 10_000_000, color: '#ff4fa3' },
  { level: 7, id: 'master', name: 'Master', threshold: 50_000_000, color: '#ff5f3d' },
  { level: 8, id: 'grandmaster', name: 'Grandmaster', threshold: 100_000_000, color: '#2ed39a' },
  { level: 9, id: 'lord', name: 'Lord', threshold: 1_000_000_000, color: 'rainbow' },
];

export function leagueForTotal(totalEarned: number): number {
  let level = 0;
  for (const league of LEAGUES) if (totalEarned >= league.threshold) level = league.level;
  return level;
}
