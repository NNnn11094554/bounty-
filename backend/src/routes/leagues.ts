import type { LeaderboardResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LEAGUES } from '../game/config/leagues.js';
import { toCoins } from '../lib/money.js';
import { leagueSnapshot, playerRank } from '../services/leaderboard.js';
import { requirePlayer } from '../services/player.js';

const Params = z.object({
  level: z.coerce
    .number()
    .int()
    .min(0)
    .max(LEAGUES.length - 1),
});

export async function leagueRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/leagues/:level/top', async (request): Promise<LeaderboardResponse> => {
    const { level } = Params.parse(request.params);
    const user = await requirePlayer(request);
    const snapshot = await leagueSnapshot(level);
    const players = snapshot.rows.map((row, i) => ({
      rank: i + 1,
      name: row.name,
      photoUrl: row.photoUrl,
      totalEarned: row.totalEarned,
      isPremium: row.isPremium,
      isMe: row.userId === user.id,
    }));
    let rank: number | null = null;
    if (user.leagueLevel === level) {
      const inTop = players.find((p) => p.isMe);
      rank = inTop ? inTop.rank : await playerRank(user);
    }
    return {
      level,
      players,
      total: snapshot.total,
      me: { rank, totalEarned: toCoins(user.totalEarned), leagueLevel: user.leagueLevel },
      updatedAt: snapshot.at,
    };
  });
}
