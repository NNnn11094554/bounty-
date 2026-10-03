import type { AuthResponse, TapResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

describe('POST /api/tap', () => {
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

  async function register(id: number) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    // как будто прошлая синхронизация была 3 секунды назад
    await prisma.user.update({
      where: { telegramId: BigInt(id) },
      data: { lastTapAt: new Date(Date.now() - 3000) },
    });
    return c;
  }

  it('credits taps, spends energy and journals them', async () => {
    const c = await register(2001);
    const res = await c.post('/api/tap', { seq: 1, taps: 40 });
    expect(res.statusCode).toBe(200);
    const body = res.json<TapResponse>();
    expect(body).toMatchObject({ accepted: 40, duplicate: false });
    expect(body.state.balance).toBe(40);
    expect(body.state.energy).toBe(4960);
    expect(body.state.tapSeq).toBe(1);
    expect(body.state.totalTaps).toBe(40);
    const tx = await prisma.transaction.findMany({ where: { type: 'tap' } });
    expect(tx).toHaveLength(1);
    expect(tx[0]!.amount.toNumber()).toBe(40);
  });

  it('aggregates many batches into one journal row per hour', async () => {
    const c = await register(2002);
    for (let seq = 1; seq <= 5; seq++) {
      await prisma.user.update({
        where: { telegramId: 2002n },
        data: { lastTapAt: new Date(Date.now() - 3000) },
      });
      await c.post('/api/tap', { seq, taps: 10 });
    }
    const rows = await prisma.transaction.findMany({ where: { type: 'tap' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount.toNumber()).toBe(50);
    expect(rows[0]!.count).toBe(5);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 2002n } });
    expect(user.balance.toNumber()).toBe(50);
  });

  it('does not pay twice for a replayed batch', async () => {
    const c = await register(2003);
    await c.post('/api/tap', { seq: 1, taps: 30 });
    const replay = await c.post('/api/tap', { seq: 1, taps: 30 });
    expect(replay.json<TapResponse>()).toMatchObject({ accepted: 0, duplicate: true });
    const older = await c.post('/api/tap', { seq: 0, taps: 30 });
    expect(older.statusCode).toBe(400);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 2003n } });
    expect(user.balance.toNumber()).toBe(30);
  });

  it('cuts scripted tapping to 20 taps/s and raises suspiciousScore', async () => {
    const c = await register(2004);
    const res = await c.post('/api/tap', { seq: 1, taps: 5000 });
    const body = res.json<TapResponse>();
    expect(body.accepted).toBeLessThanOrEqual(20 * 3 + 20 + 2);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 2004n } });
    expect(user.suspiciousScore).toBe(1);
  });

  it('cannot tap more than energy allows', async () => {
    const c = await register(2005);
    await prisma.user.update({
      where: { telegramId: 2005n },
      data: { energy: 25, energyUpdatedAt: new Date(), lastTapAt: new Date(Date.now() - 10_000) },
    });
    const body = (await c.post('/api/tap', { seq: 1, taps: 100 })).json<TapResponse>();
    expect(body.accepted).toBe(25);
    expect(body.state.energy).toBe(0);
    expect(body.state.balance).toBe(25);
  });

  it('parallel batches never exceed energy', async () => {
    const c = await register(2006);
    await prisma.user.update({
      where: { telegramId: 2006n },
      data: { energy: 50, energyUpdatedAt: new Date(), lastTapAt: new Date(Date.now() - 60_000) },
    });
    const results = await Promise.all([1, 2, 3, 4, 5].map((seq) => c.post('/api/tap', { seq, taps: 40 })));
    const accepted = results.map((r) => r.json<TapResponse>().accepted).reduce((a, b) => a + b, 0);
    expect(accepted).toBeLessThanOrEqual(51); // 50 + не больше 1 единицы восстановления за время теста
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 2006n } });
    expect(user.balance.toNumber()).toBe(accepted);
  });

  it('rejects negative, fractional and huge numbers', async () => {
    const c = await register(2007);
    for (const payload of [
      { seq: 1, taps: -5 },
      { seq: 1, taps: 1.5 },
      { seq: 1, taps: 1e9 },
      { seq: -1, taps: 1 },
      { seq: 'x', taps: 1 },
      {},
    ]) {
      const res = await c.post('/api/tap', payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 2007n } });
    expect(user.balance.toNumber()).toBe(0);
  });

  it('turbo: x5 without spending energy', async () => {
    const c = await register(2008);
    await prisma.user.update({
      where: { telegramId: 2008n },
      data: { turboUntil: new Date(Date.now() + 20_000), energy: 0 },
    });
    const body = (await c.post('/api/tap', { seq: 1, taps: 20 })).json<TapResponse>();
    expect(body.accepted).toBe(20);
    expect(body.state.balance).toBe(100);
    expect(body.state.turboUntil).not.toBeNull();
  });

  it('accrues passive income on every request, capped at 3 hours, and reports offline income', async () => {
    const c = await register(2009);
    await prisma.user.update({
      where: { telegramId: 2009n },
      data: { profitPerHour: 3600n, lastSyncAt: new Date(Date.now() - 10 * 3_600_000) },
    });
    const auth = (await c.post('/api/auth')).json<AuthResponse>();
    expect(auth.offline).not.toBeNull();
    expect(auth.offline!.earned).toBe(10_800); // 3600/ч × 3 ч, а не × 10 ч
    expect(auth.offline!.creditedSeconds).toBe(3 * 3600);
    expect(auth.offline!.seconds).toBeGreaterThanOrEqual(10 * 3600);
    expect(auth.state.balance).toBe(10_800);
    const again = (await c.post('/api/auth')).json<AuthResponse>();
    expect(again.offline).toBeNull();
  });

  it('updates the league from total earned', async () => {
    const c = await register(2010);
    await prisma.user.update({
      where: { telegramId: 2010n },
      data: { totalEarned: 4990, balance: 4990, turboUntil: new Date(Date.now() + 20_000) },
    });
    const body = (await c.post('/api/tap', { seq: 1, taps: 10 })).json<TapResponse>();
    expect(body.state.totalEarned).toBe(5040);
    expect(body.state.leagueLevel).toBe(1);
  });

  it('requires auth and limits request rate', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/api/tap', payload: { seq: 1, taps: 1 } })).statusCode,
    ).toBe(401);
    const c = await register(2011);
    let limited = 0;
    for (let seq = 1; seq <= 35; seq++)
      if ((await c.post('/api/tap', { seq, taps: 0 })).statusCode === 429) limited++;
    expect(limited).toBeGreaterThan(0);
  });
});
