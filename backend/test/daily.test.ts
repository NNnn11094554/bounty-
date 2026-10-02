import type { ApiErrorBody, DailyClaimResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REWARDS } from '../src/game/config/rewards.js';
import { dailyRewardStatus } from '../src/game/daily.js';
import { dayKey, previousDayKey } from '../src/game/dayKey.js';
import { prisma } from '../src/lib/db.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const now = new Date('2026-10-01T12:00:00Z'); // игровой день 2026-09-30 (сброс в 16:00 UTC)
const today = dayKey(now);
const yesterday = previousDayKey(today);

describe('daily reward math', () => {
  it('rewards follow the spec', () => {
    expect(REWARDS.daily).toEqual([500, 1000, 2500, 5000, 15000, 25000, 100000, 500000, 1000000, 5000000]);
  });

  it('starts from day 1', () => {
    expect(
      dailyRewardStatus({ dailyRewardDay: 0, dailyRewardDayKey: null, dailyStreak: 0 }, now),
    ).toMatchObject({
      day: 1,
      claimedToday: false,
      streakBroken: false,
      reward: 500,
    });
  });

  it('continues the streak from yesterday and wraps after day 10', () => {
    expect(
      dailyRewardStatus({ dailyRewardDay: 4, dailyRewardDayKey: yesterday, dailyStreak: 4 }, now),
    ).toMatchObject({ day: 5, streak: 4, reward: 15_000, streakBroken: false });
    expect(
      dailyRewardStatus({ dailyRewardDay: 10, dailyRewardDayKey: yesterday, dailyStreak: 10 }, now),
    ).toMatchObject({ day: 1, streak: 10, reward: 500 });
  });

  it('resets after a missed day', () => {
    expect(
      dailyRewardStatus(
        { dailyRewardDay: 6, dailyRewardDayKey: previousDayKey(yesterday), dailyStreak: 6 },
        now,
      ),
    ).toMatchObject({ day: 1, streak: 0, streakBroken: true });
  });

  it('reports today as claimed', () => {
    expect(
      dailyRewardStatus({ dailyRewardDay: 3, dailyRewardDayKey: today, dailyStreak: 3 }, now),
    ).toMatchObject({ day: 3, claimedToday: true, reward: 2_500 });
  });

  it('the day switches at the reset hour', () => {
    const before = new Date('2026-10-01T15:59:59Z');
    const after = new Date('2026-10-01T16:00:00Z');
    expect(dayKey(before)).toBe('2026-09-30');
    expect(dayKey(after)).toBe('2026-10-01');
  });
});

describe('POST /api/daily-reward/claim', () => {
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

  it('claims once per game day and grows the streak', async () => {
    const c = client(app, tgUser(7001));
    await c.post('/api/auth');
    const first = await c.post('/api/daily-reward/claim');
    expect(first.statusCode).toBe(200);
    const body = first.json<DailyClaimResponse>();
    expect(body).toMatchObject({ reward: 500, day: 1 });
    expect(body.state.balance).toBe(500);
    expect(body.state.daily).toMatchObject({ day: 1, claimedToday: true, streak: 1 });

    const again = await c.post('/api/daily-reward/claim');
    expect(again.statusCode).toBe(409);
    expect(again.json<ApiErrorBody>().error.code).toBe('ALREADY_DONE');

    // «вчерашняя» награда — сегодня следующий день серии
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 7001n } });
    await prisma.user.update({
      where: { id: user.id },
      data: { dailyRewardDayKey: previousDayKey(user.dailyRewardDayKey!), dailyRewardDay: 7, dailyStreak: 7 },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.daily).toMatchObject({ day: 8, claimedToday: false, streakBroken: false });
    const day8 = (await c.post('/api/daily-reward/claim')).json<DailyClaimResponse>();
    expect(day8).toMatchObject({ reward: 500_000, day: 8 });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.dailyStreak).toBe(8);
    expect(after.bestDailyStreak).toBe(8);
    const txs = await prisma.transaction.findMany({ where: { userId: user.id, type: 'daily_reward' } });
    expect(txs).toHaveLength(2);
  });

  it('parallel claims pay only once', async () => {
    const c = client(app, tgUser(7002));
    await c.post('/api/auth');
    const results = await Promise.all([
      c.post('/api/daily-reward/claim'),
      c.post('/api/daily-reward/claim'),
      c.post('/api/daily-reward/claim'),
    ]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 7002n } });
    expect(user.balance.toNumber()).toBe(500);
  });

  it('a missed day restarts from day 1', async () => {
    const c = client(app, tgUser(7003));
    await c.post('/api/auth');
    const key = dayKey(new Date());
    await prisma.user.update({
      where: { telegramId: 7003n },
      data: {
        dailyRewardDayKey: previousDayKey(previousDayKey(key)),
        dailyRewardDay: 9,
        dailyStreak: 9,
        bestDailyStreak: 9,
      },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.daily).toMatchObject({ day: 1, streakBroken: true, streak: 0 });
    const res = (await c.post('/api/daily-reward/claim')).json<DailyClaimResponse>();
    expect(res).toMatchObject({ day: 1, reward: 500 });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 7003n } });
    expect(user.dailyStreak).toBe(1);
    expect(user.bestDailyStreak).toBe(9);
  });
});
