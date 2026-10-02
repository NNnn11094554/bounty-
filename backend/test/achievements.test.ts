import {
  ACHIEVEMENTS,
  ACHIEVEMENT_METRICS,
  CARD_GLYPHS,
  parseCardIcon,
  type ApiErrorBody,
  type AuthResponse,
  type ProfileResponse,
  type StateResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { setAchievementsEnabled } from '../src/services/achievements.js';
import { canNotify } from '../src/services/notifications.js';
import { authHeader, client, createApp, resetDb, tgUser } from './helpers.js';

const reward = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!.reward;

describe('achievements config', () => {
  it('has 40+ achievements with unique ids, known metrics and valid icons', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_METRICS).toContain(a.metric);
      expect(a.threshold).toBeGreaterThan(0);
      expect(a.reward).toBeGreaterThan(0);
      expect(Number.isSafeInteger(a.reward)).toBe(true);
      const glyph = a.icon.split('/')[0];
      expect(CARD_GLYPHS).toContain(glyph);
      expect(glyph).not.toBe('character');
      expect(parseCardIcon(a.icon).glyph).toBe(glyph);
      expect(a.name.ru && a.name.en && a.desc.ru && a.desc.en).toBeTruthy();
    }
  });
});

describe('achievements, profile and settings API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    setAchievementsEnabled(true);
    app = await createApp();
  });
  afterAll(async () => {
    setAchievementsEnabled(false);
    await app.close();
  });
  beforeEach(resetDb);

  async function login(id: number, opts: { ref?: string } = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: authHeader(tgUser(id), { startParam: opts.ref }),
    });
    expect(res.statusCode).toBe(200);
    return res.json<AuthResponse>();
  }

  it('unlocks an achievement once, pays its reward and keeps it as fresh until seen', async () => {
    await login(17001);
    const c = client(app, tgUser(17001));
    await prisma.user.update({ where: { telegramId: 17001n }, data: { totalTaps: 995 } });

    const tap = await c.post('/api/tap', { seq: 1, taps: 10 });
    expect(tap.statusCode).toBe(200);
    const state = tap.json<StateResponse>().state;
    // награда за 1 000 тапов поднимает в лигу Silver — следом выдаётся и её достижение
    const paid = reward('taps_1k') + reward('league_1');
    expect(state.achievements.fresh).toEqual(['taps_1k', 'league_1']);
    expect(state.balance).toBe(10 + paid);
    expect(state.leagueLevel).toBe(1);
    expect(state.achievements.unlocked).toBe(2);
    expect(state.achievements.total).toBe(ACHIEVEMENTS.length);

    const ledger = await prisma.transaction.findMany({
      where: { type: 'achievement_reward' },
      orderBy: { id: 'asc' },
    });
    expect(ledger.map((t) => t.meta)).toEqual([{ achievementId: 'taps_1k' }, { achievementId: 'league_1' }]);

    // ещё тапы — повторно не выдаётся
    const again = await c.post('/api/tap', { seq: 2, taps: 10 });
    expect(again.json<StateResponse>().state.balance).toBe(20 + paid);
    expect(await prisma.userAchievement.count()).toBe(2);

    const seen = await c.post('/api/achievements/seen', { ids: ['taps_1k'] });
    expect(seen.statusCode).toBe(200);
    expect(seen.json<StateResponse>().state.achievements.fresh).toEqual(['league_1']);
    const all = await c.post('/api/achievements/seen', { ids: ['league_1', 'unknown'] });
    expect(all.json<StateResponse>().state.achievements.fresh).toEqual([]);
  });

  it('reward of one achievement can unlock the next ones in the same request', async () => {
    await login(17011);
    // 99 000 заработано: тапы → 1 000 тапов (+5 000) → 100 000 заработано (+10 000) → лига Platinum
    await prisma.user.update({
      where: { telegramId: 17011n },
      data: { totalTaps: 999, totalEarned: 99_000, leagueLevel: 2 },
    });
    const c = client(app, tgUser(17011));
    const res = await c.post('/api/tap', { seq: 1, taps: 1 });
    const state = res.json<StateResponse>().state;
    expect(state.achievements.fresh).toEqual(expect.arrayContaining(['taps_1k', 'earn_100k', 'league_3']));
    expect(state.leagueLevel).toBe(3);
  });

  it('counted achievements: first card, friends and missed ones on login', async () => {
    await login(17021);
    const c = client(app, tgUser(17021));
    await prisma.user.update({ where: { telegramId: 17021n }, data: { balance: 1_000_000 } });
    const card = await prisma.card.findFirstOrThrow({
      where: { conditionType: null, isLimited: false, isActive: true },
      orderBy: { baseCost: 'asc' },
    });
    const buy = await c.post(`/api/cards/${card.id}/upgrade`);
    expect(buy.statusCode).toBe(200);
    expect(buy.json<StateResponse>().state.achievements.fresh).toContain('cards_1');

    // друг по ссылке — достижение у пригласившего
    await login(17022, { ref: 'ref_17021' });
    const inviter = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17021n } });
    expect(inviter.achievementIds).toContain('friends_1');

    // показатель изменили в обход игры (новое достижение в конфиге) — выдаётся при входе
    await prisma.user.update({ where: { id: inviter.id }, data: { totalTaps: 12_000 } });
    const relogin = await login(17021);
    expect(relogin.state.achievements.fresh).toEqual(expect.arrayContaining(['taps_1k', 'taps_10k']));
  });

  it('profile returns stats, achievements and progress', async () => {
    await login(17031);
    await prisma.user.update({ where: { telegramId: 17031n }, data: { totalTaps: 1_234 } });
    await login(17031);
    const res = await client(app, tgUser(17031)).get('/api/profile');
    expect(res.statusCode).toBe(200);
    const body = res.json<ProfileResponse>();
    expect(body.stats).toMatchObject({ totalTaps: 1_234, daysPlayed: 1, friends: 0, cards: 0 });
    expect(body.achievements).toHaveLength(ACHIEVEMENTS.length);
    expect(body.achievements.find((a) => a.id === 'taps_1k')?.unlockedAt).toEqual(expect.any(Number));
    expect(body.achievements.find((a) => a.id === 'taps_10k')?.unlockedAt).toBeNull();
    expect(body.progress.taps).toBe(1_234);
    expect(Object.keys(body.progress).sort()).toEqual([...ACHIEVEMENT_METRICS].sort());
  });

  it('settings are validated and saved; notifications off stops bot messages', async () => {
    await login(17041);
    const c = client(app, tgUser(17041));
    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: authHeader(tgUser(17041)),
      payload: { sound: 'loud' },
    });
    expect(bad.statusCode).toBe(400);
    const unknown = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: authHeader(tgUser(17041)),
      payload: { admin: true },
    });
    expect(unknown.statusCode).toBe(400);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: authHeader(tgUser(17041)),
      payload: { language: 'en', sound: false, animations: 'reduced', notifications: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<StateResponse>().state.profile.settings).toEqual({
      language: 'en',
      sound: false,
      vibration: true,
      animations: 'reduced',
      notifications: false,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17041n } });
    expect(canNotify(user)).toBe(false);
    // язык «как в Telegram»
    const auto = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: authHeader(tgUser(17041)),
      payload: { language: null },
    });
    expect(auto.json<StateResponse>().state.profile.settings.language).toBeNull();
    expect((await c.get('/api/state')).json<StateResponse>().state.profile.settings.sound).toBe(false);
  });

  it('tutorials are marked as seen once; unknown ids are rejected', async () => {
    await login(17051);
    const c = client(app, tgUser(17051));
    expect((await c.post('/api/tutorials/mine/seen')).statusCode).toBe(200);
    const twice = await c.post('/api/tutorials/mine/seen');
    expect(twice.json<StateResponse>().state.profile.tutorialsSeen).toEqual(['mine']);
    expect((await c.post('/api/tutorials/admin/seen')).statusCode).toBe(400);
  });

  it('account deletion needs confirmation, removes progress and blocks referral farming', async () => {
    await login(17061); // пригласивший
    await login(17062, { ref: 'ref_17061' });
    const c = client(app, tgUser(17062));
    const noConfirm = await c.post('/api/account/delete', {});
    expect(noConfirm.statusCode).toBe(400);

    const del = await c.post('/api/account/delete', { confirm: true });
    expect(del.statusCode).toBe(200);
    expect(await prisma.user.findUnique({ where: { telegramId: 17062n } })).toBeNull();
    expect(await prisma.referral.count()).toBe(0);
    expect(await prisma.deletedUser.count()).toBe(1);
    const after = await c.get('/api/state');
    expect(after.json<ApiErrorBody>().error.code).toBe('UNAUTHORIZED');

    // снова зашёл по той же ссылке — новый аккаунт, но бонусов за приглашение нет
    const inviterBefore = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17061n } });
    const again = await login(17062, { ref: 'ref_17061' });
    expect(again.isNew).toBe(true);
    expect(again.referral).toBeNull();
    expect(again.state.balance).toBe(0);
    const inviterAfter = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17061n } });
    expect(inviterAfter.balance.toNumber()).toBe(inviterBefore.balance.toNumber());
  });
});
