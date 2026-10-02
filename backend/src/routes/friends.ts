import type { FriendsResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { REFERRAL } from '../game/config/rewards.js';
import { prisma } from '../lib/db.js';
import { toCoins } from '../lib/money.js';
import { displayName } from '../services/leaderboard.js';
import { requirePlayer } from '../services/player.js';
import { referralLink } from '../services/referrals.js';

const PAGE = 50;
const Query = z.object({ after: z.coerce.number().int().positive().optional() });

export async function friendRoutes(app: FastifyInstance): Promise<void> {
  /** Друзья игрока (новые сверху, по 50) и таблица бонусов. */
  app.get('/api/friends', async (request): Promise<FriendsResponse> => {
    const { after } = Query.parse(request.query);
    const user = await requirePlayer(request);
    const [rows, total, earned] = await Promise.all([
      prisma.referral.findMany({
        where: { inviterId: user.id, ...(after ? { id: { lt: after } } : {}) },
        orderBy: { id: 'desc' },
        take: PAGE + 1,
        include: {
          invitee: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
              photoUrl: true,
              isPremium: true,
              leagueLevel: true,
              balance: true,
            },
          },
        },
      }),
      prisma.referral.count({ where: { inviterId: user.id } }),
      prisma.referral.aggregate({ where: { inviterId: user.id }, _sum: { inviterEarned: true } }),
    ]);
    const page = rows.slice(0, PAGE);
    return {
      link: referralLink(user.telegramId),
      total,
      earned: Number(earned._sum.inviterEarned ?? 0n),
      friends: page.map((r) => ({
        id: r.id,
        name: displayName(r.invitee),
        photoUrl: r.invitee.photoUrl,
        isPremium: r.isPremium,
        leagueLevel: r.invitee.leagueLevel,
        balance: toCoins(r.invitee.balance),
        bonus: Number(r.inviterEarned),
        joinedAt: r.createdAt.getTime(),
      })),
      nextCursor: rows.length > PAGE ? page[page.length - 1]!.id : null,
      bonuses: {
        regular: REFERRAL.regular,
        premium: REFERRAL.premium,
        leagues: Object.entries(REFERRAL.leagues).map(([level, amount]) => ({
          level: Number(level),
          regular: amount,
          premium: amount * REFERRAL.premiumMultiplier,
        })),
      },
    };
  });
}
