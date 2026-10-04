import type { StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boostLevelPrice } from '../src/game/config/boosts.js';
import { prisma } from '../src/lib/db.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

describe('boosts', () => {
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

  async function player(id: number, data: Parameters<typeof prisma.user.update>[0]['data'] = {}) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    await prisma.user.update({ where: { telegramId: BigInt(id) }, data });
    return c;
  }

  it('prices follow 1000 × 2^(lvl−1)', () => {
    expect(boostLevelPrice('multitap', 2)).toBe(2000);
    expect(boostLevelPrice('multitap', 11)).toBe(1_024_000);
    expect(boostLevelPrice('energyLimit', 10)).toBe(512_000);
  });

  it('state exposes boost info', async () => {
    const c = await player(3001);
    const { state } = (await c.get('/api/state')).json<StateResponse>();
    expect(state.boosts.fullEnergy).toMatchObject({ left: 6, perDay: 6, cooldownUntil: null });
    expect(state.boosts.turbo).toMatchObject({
      left: 3,
      perDay: 3,
      activeUntil: null,
      durationSec: 60,
      multiplier: 5,
    });
    expect(state.boosts.multitap).toMatchObject({ level: 1, nextLevel: 2, price: 2000 });
    expect(state.boosts.energyLimit).toMatchObject({ level: 1, nextLevel: 2, price: 2000, perLevel: 500 });
  });

  it('full energy refills, then cooldown 1h, max 6 per day', async () => {
    const c = await player(3002, { energy: 10, energyUpdatedAt: new Date() });
    const res = await c.post('/api/boost/full-energy');
    expect(res.statusCode).toBe(200);
    const { state } = res.json<StateResponse>();
    expect(state.energy).toBe(5000);
    expect(state.boosts.fullEnergy.left).toBe(5);
    expect(state.boosts.fullEnergy.cooldownUntil).toBeGreaterThan(Date.now() + 3500_000);
    const again = await c.post('/api/boost/full-energy');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'COOLDOWN' } });
    // кулдаун прошёл, но лимит дня исчерпан
    await prisma.user.update({
      where: { telegramId: 3002n },
      data: { fullEnergyUsedToday: 6, fullEnergyLastAt: new Date(Date.now() - 2 * 3600_000) },
    });
    const limited = await c.post('/api/boost/full-energy');
    expect(limited.json()).toMatchObject({ error: { code: 'LIMIT_REACHED' } });
  });

  it('daily counters reset with the game day', async () => {
    const c = await player(3003, {
      boostsDayKey: '2000-01-01',
      fullEnergyUsedToday: 6,
      turboUsedToday: 3,
      fullEnergyLastAt: new Date(Date.now() - 2 * 3600_000),
    });
    const { state } = (await c.get('/api/state')).json<StateResponse>();
    expect(state.boosts.fullEnergy.left).toBe(6);
    expect(state.boosts.turbo.left).toBe(3);
    expect((await c.post('/api/boost/full-energy')).statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 3003n } });
    expect(user.fullEnergyUsedToday).toBe(1);
    expect(user.turboUsedToday).toBe(0);
  });

  it('turbo activates for 20s, cannot stack, 3 per day', async () => {
    const c = await player(3004);
    const { state } = (await c.post('/api/boost/turbo')).json<StateResponse>();
    expect(state.turboUntil).toBeGreaterThan(Date.now() + 15_000);
    expect(state.boosts.turbo.left).toBe(2);
    const stack = await c.post('/api/boost/turbo');
    expect(stack.json()).toMatchObject({ error: { code: 'CONFLICT' } });
    await prisma.user.update({ where: { telegramId: 3004n }, data: { turboUntil: null, turboUsedToday: 3 } });
    expect((await c.post('/api/boost/turbo')).json()).toMatchObject({ error: { code: 'LIMIT_REACHED' } });
  });

  it('energy limit costs coins and raises the level; multitap is no longer sold', async () => {
    const c = await player(3005, { balance: 10_000, totalEarned: 10_000 });
    const no = await c.post('/api/boost/multitap');
    expect(no.statusCode).toBe(400);
    expect(no.json()).toMatchObject({ error: { code: 'VALIDATION' } });
    const r1 = (await c.post('/api/boost/energy-limit')).json<StateResponse>().state;
    expect(r1.maxEnergy).toBe(5500);
    expect(r1.balance).toBe(8000);
    const r2 = (await c.post('/api/boost/energy-limit')).json<StateResponse>().state;
    expect(r2.maxEnergy).toBe(6000);
    expect(r2.balance).toBe(4000);
    expect(r2.totalEarned).toBe(10_000); // траты не уменьшают «всего заработано»
    expect(r2.multitapLevel).toBe(1);
    const tx = await prisma.transaction.findMany({
      where: { type: 'boost_purchase' },
      orderBy: { id: 'asc' },
    });
    expect(tx.map((t) => t.amount.toNumber())).toEqual([-2000, -4000]);
    expect(tx[1]!.balanceAfter.toNumber()).toBe(4000);
  });

  it('multitap levels bought earlier are kept: taps still pay more', async () => {
    const c = await player(3009, { multitapLevel: 7 });
    const { state } = (await c.get('/api/state')).json<StateResponse>();
    expect(state.tapValue).toBe(7);
  });

  it('cannot buy without enough coins', async () => {
    const c = await player(3006, { balance: 1999 });
    const res = await c.post('/api/boost/energy-limit');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'INSUFFICIENT_FUNDS' } });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 3006n } });
    expect(user.energyLimitLevel).toBe(1);
    expect(user.balance.toNumber()).toBe(1999);
  });

  it('double click / parallel purchases never overspend', async () => {
    const c = await player(3007, { balance: 5000 });
    const results = await Promise.all(Array.from({ length: 6 }, () => c.post('/api/boost/energy-limit')));
    const ok = results.filter((r) => r.statusCode === 200).length;
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 3007n } });
    // 2000 (ур.2) + 4000 (ур.3) > 5000, значит удаётся только одна покупка
    expect(ok).toBe(1);
    expect(user.energyLimitLevel).toBe(2);
    expect(user.balance.toNumber()).toBe(3000);
  });

  it('max level and unknown boost', async () => {
    const c = await player(3008, { energyLimitLevel: 30, balance: 1e12 });
    expect((await c.post('/api/boost/energy-limit')).json()).toMatchObject({
      error: { code: 'LIMIT_REACHED' },
    });
    const { state } = (await c.get('/api/state')).json<StateResponse>();
    expect(state.boosts.energyLimit).toMatchObject({ level: 30, nextLevel: null, price: null });
    expect((await c.post('/api/boost/free-money')).statusCode).toBe(400);
  });
});
