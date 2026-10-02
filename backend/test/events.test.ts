import type { ApiErrorBody, GoldenCoinClaimResponse, StateResponse, TapResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EVENTS } from '../src/game/config/events.js';
import { dayKey, dayStart } from '../src/game/dayKey.js';
import { prisma } from '../src/lib/db.js';
import {
  autoHappyHour,
  goldenCoinReward,
  happyHourMultiplier,
  nextHappyHour,
  setEventRandom,
} from '../src/services/events.js';
import { announceHappyHour } from '../src/services/notifications.js';
import { setAppSetting, type AppSettings } from '../src/services/settings.js';
import { authHeader, client, createApp, resetDb, tgUser } from './helpers.js';

const HOUR = 3_600_000;
const settings = (happyHour: AppSettings['happyHour']): AppSettings => ({
  maintenance: { enabled: false, message: '' },
  minClientVersion: '1.0.0',
  happyHour,
  goldenCoin: { enabled: true },
});

describe('happy hour schedule', () => {
  it('is one hour a day, at the same time for everyone, inside the allowed window', () => {
    for (const key of ['2026-10-01', '2026-10-02', '2026-12-31', '2027-02-14']) {
      const hh = autoHappyHour(key);
      const start = dayStart(key).getTime();
      expect(hh.endsAt - hh.startsAt).toBe(HOUR);
      expect(hh.startsAt - start).toBeGreaterThanOrEqual(2 * HOUR);
      expect(hh.startsAt - start).toBeLessThanOrEqual(21 * HOUR);
      expect((hh.startsAt - start) % (15 * 60_000)).toBe(0);
      expect(hh.multiplier).toBe(2);
      expect(autoHappyHour(key)).toEqual(hh);
    }
  });

  it('next happy hour: upcoming, active, then tomorrow; admin one and switching off', () => {
    const key = '2026-10-01';
    const today = autoHappyHour(key);
    const tomorrow = autoHappyHour('2026-10-02');
    const auto = settings({ auto: true, override: null });
    const before = new Date(today.startsAt - 60_000);
    const during = new Date(today.startsAt + 60_000);
    const after = new Date(today.endsAt + 60_000);
    expect(nextHappyHour(auto, before)).toEqual(today);
    expect(happyHourMultiplier(auto, before)).toBe(1);
    expect(nextHappyHour(auto, during)).toEqual(today);
    expect(happyHourMultiplier(auto, during)).toBe(2);
    expect(dayKey(after)).toBe(key);
    expect(nextHappyHour(auto, after)).toEqual(tomorrow);

    const override = {
      startsAt: new Date(before.getTime() - 10 * 60_000).toISOString(),
      endsAt: new Date(before.getTime() + 20 * 60_000).toISOString(),
      multiplier: 3,
    };
    expect(happyHourMultiplier(settings({ auto: true, override }), before)).toBe(3);
    expect(nextHappyHour(settings({ auto: false, override: null }), before)).toBeNull();
  });

  it('golden coin reward is a share of profit per hour, at least 1 000', () => {
    expect(goldenCoinReward(0)).toBe(1_000);
    expect(goldenCoinReward(100_000)).toBe(25_000);
    expect(goldenCoinReward(12_345)).toBe(3_100);
  });
});

describe('events API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDb);
  afterEach(() => setEventRandom(Math.random));

  async function login(id: number) {
    const res = await app.inject({ method: 'POST', url: '/api/auth', headers: authHeader(tgUser(id)) });
    expect(res.statusCode).toBe(200);
  }

  it('taps earn double during happy hour and the state shows it', async () => {
    const now = Date.now();
    await setAppSetting('happyHour', {
      auto: false,
      override: {
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + HOUR).toISOString(),
        multiplier: 2,
      },
    });
    await login(18001);
    const c = client(app, tgUser(18001));
    const res = await c.post('/api/tap', { seq: 1, taps: 20 });
    const body = res.json<TapResponse>();
    expect(body.accepted).toBe(20);
    expect(body.state.balance).toBe(40);
    expect(body.state.events.happyHour).toMatchObject({ multiplier: 2 });
    // энергия тратится как обычно — множитель только на монеты
    expect(body.state.energy).toBe(body.state.maxEnergy - 20);

    await setAppSetting('happyHour', { auto: false, override: null });
    const plain = await c.post('/api/tap', { seq: 2, taps: 10 });
    expect(plain.json<TapResponse>().state.balance).toBe(50);
    expect(plain.json<TapResponse>().state.events.happyHour).toBeNull();
  });

  it('golden coin: appears after taps, caught once in time, credited through the ledger', async () => {
    await setAppSetting('goldenCoin', { enabled: true });
    setEventRandom(() => 0);
    await login(18011);
    const c = client(app, tgUser(18011));
    const tap = await c.post('/api/tap', { seq: 1, taps: 5 });
    const coin = tap.json<TapResponse>().goldenCoin!;
    expect(coin).toMatchObject({ reward: 1_000 });
    expect(coin.expiresAt - coin.appearsAt).toBe(EVENTS.goldenCoin.visibleMs);

    // «поймал» раньше, чем монета появилась, — так может только скрипт
    const early = await c.post(`/api/events/${coin.id}/claim`);
    expect(early.statusCode).toBe(400);
    let user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 18011n } });
    expect(user.suspiciousScore).toBe(1);

    await prisma.userEvent.update({
      where: { id: coin.id },
      data: { appearsAt: new Date(Date.now() - 1_000), expiresAt: new Date(Date.now() + 2_000) },
    });
    const [a, b] = await Promise.all([
      c.post(`/api/events/${coin.id}/claim`),
      c.post(`/api/events/${coin.id}/claim`),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const ok = (a.statusCode === 200 ? a : b).json<GoldenCoinClaimResponse>();
    expect(ok.reward).toBe(1_000);
    expect(ok.state.balance).toBe(5 + 1_000);
    const ledger = await prisma.transaction.findMany({ where: { type: 'golden_coin' } });
    expect(ledger).toHaveLength(1);

    // чужую монету поймать нельзя
    await login(18012);
    const other = await client(app, tgUser(18012)).post(`/api/events/${coin.id}/claim`);
    expect(other.json<ApiErrorBody>().error.code).toBe('NOT_FOUND');
    user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 18011n } });
    expect(user.balance.toNumber()).toBe(1_005);
  });

  it('golden coin: runs away after 3 seconds; at most 3 a day, 20 minutes apart', async () => {
    await setAppSetting('goldenCoin', { enabled: true });
    setEventRandom(() => 0);
    await login(18021);
    const c = client(app, tgUser(18021));
    const coin = (await c.post('/api/tap', { seq: 1, taps: 1 })).json<TapResponse>().goldenCoin!;
    // следующая пачка через секунду — монеты нет: прошло меньше 20 минут
    expect((await c.post('/api/tap', { seq: 2, taps: 1 })).json<TapResponse>().goldenCoin).toBeNull();

    await prisma.userEvent.update({
      where: { id: coin.id },
      data: { appearsAt: new Date(Date.now() - 10_000), expiresAt: new Date(Date.now() - 7_000) },
    });
    const late = await c.post(`/api/events/${coin.id}/claim`);
    expect(late.json<ApiErrorBody>().error.code).toBe('NOT_COMPLETED');

    // ещё две монеты сегодня (давно), третья уже есть — больше не появляется
    const since = dayStart(dayKey()).getTime();
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 18021n } });
    await prisma.userEvent.updateMany({
      where: { userId: user.id },
      data: { appearsAt: new Date(since + 1_000) },
    });
    await prisma.userEvent.createMany({
      data: [1, 2].map((i) => ({
        userId: user.id,
        kind: 'golden_coin',
        reward: 1_000n,
        appearsAt: new Date(since + i * 2_000),
        expiresAt: new Date(since + i * 2_000 + 3_000),
      })),
    });
    expect((await c.post('/api/tap', { seq: 3, taps: 1 })).json<TapResponse>().goldenCoin).toBeNull();
  });

  it('switched off by the admin setting', async () => {
    setEventRandom(() => 0);
    await login(18031);
    const res = await client(app, tgUser(18031)).post('/api/tap', { seq: 1, taps: 3 });
    expect(res.json<TapResponse>().goldenCoin).toBeNull();
  });

  it('happy hour start is announced once to recently active players', async () => {
    const now = Date.now();
    await setAppSetting('happyHour', {
      auto: false,
      override: {
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + HOUR).toISOString(),
        multiplier: 2,
      },
    });
    await login(18041);
    await login(18042);
    await prisma.user.update({
      where: { telegramId: 18042n },
      data: { settings: { notifications: false } },
    });
    expect(await announceHappyHour()).toBe(1);
    expect(await announceHappyHour()).toBe(0);
    const queued = await prisma.notification.findMany({ where: { kind: 'happy_hour' } });
    expect(queued).toHaveLength(1);
    const state = await client(app, tgUser(18041)).get('/api/state');
    expect(state.json<StateResponse>().state.events.happyHour?.multiplier).toBe(2);
  });
});
