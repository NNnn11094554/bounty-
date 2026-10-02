import type { AirdropResponse, AuthResponse, StateResponse, TasksResponse } from '@meowgul/shared';
import { ACHIEVEMENTS, TON_WALLET_ENABLED } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { seedTasks } from '../src/services/tasks.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

describe('airdrop without a wallet; TON wallet hidden behind a flag', () => {
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

  it('points, rank among players and requirement progress', async () => {
    const a = client(app, tgUser(18001));
    const b = client(app, tgUser(18002));
    await a.post('/api/auth');
    await b.post('/api/auth');
    await prisma.user.update({
      where: { telegramId: 18001n },
      data: { totalEarned: 500_000, leagueLevel: 3 },
    });
    await prisma.user.update({
      where: { telegramId: 18002n },
      data: { totalEarned: 10_000, bestDailyStreak: 9 },
    });

    const res = await a.get('/api/airdrop');
    expect(res.statusCode).toBe(200);
    const body = res.json<AirdropResponse>();
    expect(body).toMatchObject({ points: 500_000, rank: 1, players: 2, walletEnabled: false });
    expect(body.requirements.find((r) => r.id === 'league')).toEqual({
      id: 'league',
      current: 3,
      target: 3,
      done: true,
    });
    expect(body.requirements.map((r) => r.id)).toEqual([
      'league',
      'level',
      'friends',
      'streak',
      'cards',
      'tasks',
    ]);
    expect(body.progress).toBeCloseTo(1 / 6);

    const second = (await b.get('/api/airdrop')).json<AirdropResponse>();
    expect(second.rank).toBe(2);
    expect(second.requirements.find((r) => r.id === 'streak')!.done).toBe(true);
  });

  it('the wallet task and achievement are hidden, the wallet API is kept', async () => {
    expect(TON_WALLET_ENABLED).toBe(false);
    await seedTasks();
    const c = client(app, tgUser(18003));
    const auth = (await c.post('/api/auth')).json<AuthResponse>();
    expect(auth.state.achievements.total).toBe(ACHIEVEMENTS.length - 1);
    const tasks = (await c.get('/api/tasks')).json<TasksResponse>().tasks;
    expect(tasks.some((t) => t.type === 'CONNECT_WALLET')).toBe(false);
    expect(await prisma.task.findUnique({ where: { id: 'connect_wallet' } })).not.toBeNull();
    // будущая интеграция на месте: payload для ton_proof по-прежнему выдаётся
    expect((await c.get('/api/wallet/proof-payload')).statusCode).toBe(200);
    // достижение за кошелёк, полученное раньше, не превращает счётчик в «N+1 из N»
    await prisma.user.update({
      where: { telegramId: 18003n },
      data: { achievementIds: ['wallet_connected'], newAchievementIds: [] },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.achievements).toMatchObject({ unlocked: 0, total: ACHIEVEMENTS.length - 1 });
  });
});
