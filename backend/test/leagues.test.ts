import type { ApiErrorBody, LeaderboardResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { clearLeaderboardCache, displayName } from '../src/services/leaderboard.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

describe('league leaderboards', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
  });

  async function addPlayers(count: number, level: number, base: number, from = 1): Promise<void> {
    await prisma.user.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        telegramId: BigInt(900_000 + from + i),
        firstName: `P${from + i}`,
        totalEarned: base + (count - i) * 10,
        balance: 0,
        leagueLevel: level,
      })),
    });
  }

  it('returns the top 100 of a league ordered by total earned, with my place', async () => {
    await addPlayers(120, 1, 10_000);
    const me = client(app, tgUser(6001, { first_name: 'Мурка', last_name: 'Котова' }));
    await me.post('/api/auth');
    await prisma.user.update({ where: { telegramId: 6001n }, data: { leagueLevel: 1, totalEarned: 10_005 } });

    const res = await me.get('/api/leagues/1/top');
    expect(res.statusCode).toBe(200);
    const body = res.json<LeaderboardResponse>();
    expect(body.level).toBe(1);
    expect(body.total).toBe(121);
    expect(body.players).toHaveLength(100);
    expect(body.players[0]).toMatchObject({ rank: 1, name: 'P1', totalEarned: 11_200, isMe: false });
    expect(body.players.map((p) => p.totalEarned)).toEqual(
      [...body.players.map((p) => p.totalEarned)].sort((a, b) => b - a),
    );
    // все 120 игроков заработали больше
    expect(body.me).toEqual({ rank: 121, totalEarned: 10_005, leagueLevel: 1 });
  });

  it('marks me inside the top and hides banned players and other leagues', async () => {
    await addPlayers(3, 2, 30_000);
    await addPlayers(2, 3, 200_000, 50);
    await prisma.user.update({ where: { telegramId: 900_001n }, data: { isBanned: true } });
    const me = client(app, tgUser(6002, { first_name: 'Барсик', last_name: 'Пушистый' }));
    await me.post('/api/auth');
    await prisma.user.update({ where: { telegramId: 6002n }, data: { leagueLevel: 2, totalEarned: 30_015 } });

    const body = (await me.get('/api/leagues/2/top')).json<LeaderboardResponse>();
    expect(body.total).toBe(3);
    expect(body.players.map((p) => p.name)).toEqual(['P2', 'Барсик П.', 'P3']);
    expect(body.players[1]).toMatchObject({ rank: 2, isMe: true });
    expect(body.me.rank).toBe(2);

    const other = (await me.get('/api/leagues/3/top')).json<LeaderboardResponse>();
    expect(other.players).toHaveLength(2);
    expect(other.me.rank).toBeNull();
  });

  it('caches the leaderboard for a minute', async () => {
    await addPlayers(2, 0, 100);
    const me = client(app, tgUser(6003));
    await me.post('/api/auth');
    const first = (await me.get('/api/leagues/0/top')).json<LeaderboardResponse>();
    expect(first.total).toBe(3);
    await addPlayers(2, 0, 1_000, 10);
    const cached = (await me.get('/api/leagues/0/top')).json<LeaderboardResponse>();
    expect(cached.total).toBe(3);
    expect(cached.updatedAt).toBe(first.updatedAt);
    clearLeaderboardCache();
    const fresh = (await me.get('/api/leagues/0/top')).json<LeaderboardResponse>();
    expect(fresh.total).toBe(5);
    expect(fresh.players[0]!.name).toBe('P10');
  });

  it('validates the league level', async () => {
    const me = client(app, tgUser(6004));
    await me.post('/api/auth');
    expect((await me.get('/api/leagues/10/top')).statusCode).toBe(400);
    expect((await me.get('/api/leagues/-1/top')).json<ApiErrorBody>().error.code).toBe('VALIDATION');
    expect((await me.get('/api/leagues/abc/top')).statusCode).toBe(400);
  });

  it('formats display names', () => {
    expect(displayName({ firstName: 'Мурка', lastName: 'Котова', username: null })).toBe('Мурка К.');
    expect(displayName({ firstName: ' ', lastName: null, username: 'cat' })).toBe('cat');
    expect(displayName({ firstName: '', lastName: null, username: null })).toBe('Player');
  });
});
