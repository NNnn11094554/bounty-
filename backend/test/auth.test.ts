import type { AuthResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { setAppSetting } from '../src/services/settings.js';
import { authHeader, client, createApp, initDataFor, resetDb, tgUser } from './helpers.js';

describe('POST /api/auth', () => {
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

  it('registers a new player and returns full state', async () => {
    const res = await client(app, tgUser(1001, { is_premium: true, language_code: 'uk' })).post('/api/auth');
    expect(res.statusCode).toBe(200);
    const body = res.json<AuthResponse>();
    expect(body.isNew).toBe(true);
    expect(body.state.profile).toMatchObject({
      telegramId: '1001',
      firstName: 'Cat1001',
      isPremium: true,
      languageCode: 'ru',
    });
    expect(body.state).toMatchObject({
      balance: 0,
      energy: 1000,
      maxEnergy: 1000,
      tapValue: 1,
      leagueLevel: 0,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 1001n } });
    expect(user.allowsWriteToPm).toBe(true);
    expect(await prisma.userActivity.count({ where: { userId: user.id } })).toBe(1);
  });

  it('updates the profile on next login and does not duplicate the player', async () => {
    await client(app, tgUser(1002)).post('/api/auth');
    const res = await client(app, tgUser(1002, { first_name: 'Новое имя', language_code: 'en' })).post(
      '/api/auth',
    );
    const body = res.json<AuthResponse>();
    expect(body.isNew).toBe(false);
    expect(body.state.profile.firstName).toBe('Новое имя');
    expect(body.state.profile.languageCode).toBe('en');
    expect(await prisma.user.count()).toBe(1);
  });

  it('handles parallel first logins without duplicates', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => client(app, tgUser(1003)).post('/api/auth')),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(await prisma.user.count({ where: { telegramId: 1003n } })).toBe(1);
  });

  it('rejects missing, forged and expired init data', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/auth' })).statusCode).toBe(401);
    const forged = new URLSearchParams(initDataFor(tgUser(1004)));
    forged.set('user', JSON.stringify(tgUser(1)));
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization: `tma ${forged}` },
    });
    expect(r1.statusCode).toBe(401);
    expect(r1.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    const old = initDataFor(tgUser(1004), { authDate: new Date(Date.now() - 2 * 86400_000) });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization: `tma ${old}` },
    });
    expect(r2.statusCode).toBe(401);
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization: `Bearer ${initDataFor(tgUser(1004))}` },
    });
    expect(r3.statusCode).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('blocks banned players', async () => {
    await client(app, tgUser(1005)).post('/api/auth');
    await prisma.user.update({
      where: { telegramId: 1005n },
      data: { isBanned: true, banReason: 'cheating' },
    });
    const res = await client(app, tgUser(1005)).post('/api/auth');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: { code: 'BANNED', details: { reason: 'cheating' } } });
    expect((await client(app, tgUser(1005)).get('/api/state')).statusCode).toBe(403);
  });

  it('GET /api/state requires registration', async () => {
    expect((await client(app, tgUser(1006)).get('/api/state')).statusCode).toBe(401);
    await client(app, tgUser(1006)).post('/api/auth');
    const res = await client(app, tgUser(1006)).get('/api/state');
    expect(res.statusCode).toBe(200);
    expect(res.json<StateResponse>().state.profile.telegramId).toBe('1006');
  });

  it('marks admins and supports maintenance and minimum client version', async () => {
    const admin = await client(app, tgUser(999000999)).post('/api/auth');
    expect(admin.json<AuthResponse>().state.profile.isAdmin).toBe(true);

    await setAppSetting('maintenance', { enabled: true, message: 'Чиним кота' });
    const blocked = await client(app, tgUser(1007)).post('/api/auth');
    expect(blocked.statusCode).toBe(503);
    expect(blocked.json()).toMatchObject({ error: { code: 'MAINTENANCE', message: 'Чиним кота' } });
    expect((await client(app, tgUser(999000999)).post('/api/auth')).statusCode).toBe(200); // админ проходит
    await setAppSetting('maintenance', { enabled: false, message: '' });

    await setAppSetting('minClientVersion', '1.2.0');
    const old = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { ...authHeader(tgUser(1007)), 'x-client-version': '1.1.9' },
    });
    expect(old.statusCode).toBe(426);
    expect(old.json()).toMatchObject({
      error: { code: 'OUTDATED_CLIENT', details: { minVersion: '1.2.0' } },
    });
    const fresh = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { ...authHeader(tgUser(1007)), 'x-client-version': '1.2.0' },
    });
    expect(fresh.statusCode).toBe(200);
    await setAppSetting('minClientVersion', '1.0.0');
  });

  it('dev endpoint issues valid init data outside production', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/init-data?id=555&premium=1&start_param=ref_1',
    });
    expect(res.statusCode).toBe(200);
    const { initData } = res.json<{ initData: string }>();
    const auth = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: { authorization: `tma ${initData}` },
    });
    expect(auth.json<AuthResponse>().state.profile).toMatchObject({ telegramId: '555', isPremium: true });
  });

  it('reports offline income after an absence of more than a minute', async () => {
    const c = client(app, tgUser(1010));
    expect((await c.post('/api/auth')).json<AuthResponse>().offline).toBeNull();
    await prisma.user.update({
      where: { telegramId: 1010n },
      data: { profitPerHour: 3600n, lastSyncAt: new Date(Date.now() - 30_000) },
    });
    // меньше минуты — доход начислен, но без модалки
    let res = (await c.post('/api/auth')).json<AuthResponse>();
    expect(res.offline).toBeNull();
    expect(res.state.balance).toBeGreaterThanOrEqual(30);

    await prisma.user.update({
      where: { telegramId: 1010n },
      data: { balance: 0, lastSyncAt: new Date(Date.now() - 5 * 3600_000) },
    });
    res = (await c.post('/api/auth')).json<AuthResponse>();
    expect(res.offline).toMatchObject({ earned: 10_800, creditedSeconds: 3 * 3600 });
    expect(res.offline?.seconds).toBeGreaterThanOrEqual(5 * 3600);
    expect(res.state.balance).toBe(10_800);
  });

  it('rate limits per player', async () => {
    await client(app, tgUser(1008)).post('/api/auth');
    const c = client(app, tgUser(1008));
    let limited = 0;
    for (let i = 0; i < 65; i++) if ((await c.get('/api/state')).statusCode === 429) limited++;
    expect(limited).toBeGreaterThan(0);
    // другой игрок не затронут
    await client(app, tgUser(1009)).post('/api/auth');
    expect((await client(app, tgUser(1009)).get('/api/state')).statusCode).toBe(200);
  });
});
