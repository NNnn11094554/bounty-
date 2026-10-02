import {
  playerLevel,
  TON_WALLET_ENABLED,
  type AirdropRequirement,
  type AirdropRequirementId,
  type AirdropResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';
import { toCoins } from '../lib/money.js';
import { requirePlayer } from '../services/player.js';

/** Требования Airdrop (без кошелька): лига Platinum, уровень 10, 3 друга, серия 7 дней, 15 карточек, 5 заданий. */
const TARGETS: Record<AirdropRequirementId, number> = {
  league: 3,
  level: 10,
  friends: 3,
  streak: 7,
  cards: 15,
  tasks: 5,
};

/** Место в рейтинге считается запросом COUNT — кэшируем на полминуты, чтобы вкладка не грузила базу. */
const RANK_TTL_MS = 30_000;
const rankCache = new Map<number, { at: number; rank: number; players: number; earned: string }>();

async function rankOf(userId: number, earned: { toString(): string }) {
  const cached = rankCache.get(userId);
  if (cached && Date.now() - cached.at < RANK_TTL_MS && cached.earned === earned.toString()) return cached;
  const [above, players] = await Promise.all([
    prisma.user.count({ where: { isBanned: false, totalEarned: { gt: earned.toString() } } }),
    prisma.user.count({ where: { isBanned: false } }),
  ]);
  const value = { at: Date.now(), rank: above + 1, players, earned: earned.toString() };
  if (rankCache.size > 50_000) rankCache.clear();
  rankCache.set(userId, value);
  return value;
}

export async function airdropRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/airdrop', async (request): Promise<AirdropResponse> => {
    const user = await requirePlayer(request);
    const [{ rank, players }, friends, cards, tasks] = await Promise.all([
      rankOf(user.id, user.totalEarned),
      prisma.referral.count({ where: { inviterId: user.id } }),
      prisma.userCard.count({ where: { userId: user.id, level: { gt: 0 } } }),
      prisma.userTask.count({ where: { userId: user.id, status: 'DONE' } }),
    ]);
    const points = toCoins(user.totalEarned);
    const current: Record<AirdropRequirementId, number> = {
      league: user.leagueLevel,
      level: playerLevel(points).level,
      friends,
      streak: user.bestDailyStreak,
      cards,
      tasks,
    };
    const requirements: AirdropRequirement[] = (Object.keys(TARGETS) as AirdropRequirementId[]).map((id) => ({
      id,
      current: Math.min(current[id], TARGETS[id]),
      target: TARGETS[id],
      done: current[id] >= TARGETS[id],
    }));
    return {
      points,
      rank,
      players,
      requirements,
      progress: requirements.filter((r) => r.done).length / requirements.length,
      walletEnabled: TON_WALLET_ENABLED,
    };
  });
}
