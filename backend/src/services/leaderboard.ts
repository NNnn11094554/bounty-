import type { User } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { toCoins } from '../lib/money.js';

/** Рейтинг лиги собирается SQL-запросом и кэшируется на минуту (на процесс). */
export const LEADERBOARD_TTL_MS = 60_000;
export const LEADERBOARD_SIZE = 100;
/** сколько мест игроков держать в кэше одновременно */
const RANK_CACHE_LIMIT = 50_000;

export interface LeaderboardRow {
  userId: number;
  name: string;
  photoUrl: string | null;
  totalEarned: number;
  isPremium: boolean;
}

interface LeagueSnapshot {
  at: number;
  rows: LeaderboardRow[];
  total: number;
}

const snapshots = new Map<number, LeagueSnapshot>();
const loading = new Map<number, Promise<LeagueSnapshot>>();
const ranks = new Map<number, { at: number; level: number; rank: number }>();

/** Имя в рейтинге: имя и первая буква фамилии. */
export function displayName(user: Pick<User, 'firstName' | 'lastName' | 'username'>): string {
  const first = user.firstName.trim() || user.username || 'Player';
  const last = user.lastName?.trim();
  return last ? `${first} ${last.slice(0, 1)}.` : first;
}

async function loadSnapshot(level: number): Promise<LeagueSnapshot> {
  const where = { leagueLevel: level, isBanned: false };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ totalEarned: 'desc' }, { id: 'asc' }],
      take: LEADERBOARD_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        photoUrl: true,
        totalEarned: true,
        isPremium: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    at: Date.now(),
    total,
    rows: users.map((u) => ({
      userId: u.id,
      name: displayName(u),
      photoUrl: u.photoUrl,
      totalEarned: toCoins(u.totalEarned),
      isPremium: u.isPremium,
    })),
  };
}

/** Топ лиги (из кэша, если он моложе минуты; параллельные запросы ждут одну загрузку). */
export async function leagueSnapshot(level: number): Promise<LeagueSnapshot> {
  const cached = snapshots.get(level);
  if (cached && Date.now() - cached.at < LEADERBOARD_TTL_MS) return cached;
  let pending = loading.get(level);
  if (!pending) {
    pending = loadSnapshot(level)
      .then((snap) => {
        snapshots.set(level, snap);
        return snap;
      })
      .finally(() => loading.delete(level));
    loading.set(level, pending);
  }
  return pending;
}

/** Место игрока в его лиге: выше — те, у кого заработано больше (при равенстве — кто раньше пришёл). */
export async function playerRank(user: User): Promise<number> {
  const cached = ranks.get(user.id);
  if (cached && cached.level === user.leagueLevel && Date.now() - cached.at < LEADERBOARD_TTL_MS) {
    return cached.rank;
  }
  const above = await prisma.user.count({
    where: {
      leagueLevel: user.leagueLevel,
      isBanned: false,
      OR: [{ totalEarned: { gt: user.totalEarned } }, { totalEarned: user.totalEarned, id: { lt: user.id } }],
    },
  });
  const rank = above + 1;
  ranks.delete(user.id);
  ranks.set(user.id, { at: Date.now(), level: user.leagueLevel, rank });
  if (ranks.size > RANK_CACHE_LIMIT) {
    const oldest = ranks.keys().next().value;
    if (oldest !== undefined) ranks.delete(oldest);
  }
  return rank;
}

/** Сбросить кэш рейтинга (админка, тесты). */
export function clearLeaderboardCache(): void {
  snapshots.clear();
  ranks.clear();
}
