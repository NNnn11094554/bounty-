import type {
  AdminBroadcast,
  AdminCard,
  AdminCardInput,
  AdminPlayerDetails,
  AdminPlayerRow,
  AdminSettings,
  AdminStats,
  ApiErrorBody,
  CardPreviewResponse,
  CardsResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { dayKey, dayStart, previousDayKey } from '../src/game/dayKey.js';
import { prisma } from '../src/lib/db.js';
import { processBroadcasts } from '../src/services/broadcasts.js';
import { TelegramSendError, type TelegramGateway } from '../src/services/telegram.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const ADMIN_ID = 999000999;

const newCard: AdminCardInput = {
  category: 'LAYER1',
  nameRu: 'Тестовая сеть',
  nameEn: 'Test chain',
  descRu: 'Описание',
  descEn: 'Description',
  icon: 'token/TEST/4',
  rarity: 'common',
  starsPrice: null,
  baseCost: 1_000,
  baseProfit: 150,
  costMultiplier: 1.9,
  profitMultiplier: 1.1,
  maxLevel: 20,
  cooldownSec: 0,
  condition: null,
  isLimited: false,
  availableFrom: null,
  availableUntil: null,
  isActive: true,
  sortOrder: 500,
};

describe('admin API', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(resetDb);

  async function login(id: number, extra: Parameters<typeof prisma.user.update>[0]['data'] = {}) {
    await client(app, tgUser(id)).post('/api/auth');
    return prisma.user.update({ where: { telegramId: BigInt(id) }, data: extra });
  }
  const admin = () => client(app, tgUser(ADMIN_ID));

  it('every admin endpoint is closed to players', async () => {
    await login(19001);
    const c = client(app, tgUser(19001));
    const calls = [
      c.get('/api/admin/stats'),
      c.get('/api/admin/cards'),
      c.post('/api/admin/cards/preview', { card: newCard }),
      c.get('/api/admin/players?q=a'),
      c.get('/api/admin/players/1'),
      c.post('/api/admin/players/1/credit', { amount: 1, reason: 'test' }),
      c.post('/api/admin/players/1/ban', { reason: 'test' }),
      c.get('/api/admin/suspicious'),
      c.get('/api/admin/broadcasts'),
      c.post('/api/admin/broadcasts', { text: 'hi' }),
      c.get('/api/admin/settings'),
      c.put('/api/admin/settings', { goldenCoin: { enabled: true } }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.statusCode).toBe(403);
      expect(res.json<ApiErrorBody>().error.code).toBe('FORBIDDEN');
    }
  });

  it('stats: players, activity, retention, coins and top referrers', async () => {
    await login(ADMIN_ID);
    const today = dayKey();
    const yesterday = previousDayKey(today);
    const twoDaysAgo = previousDayKey(yesterday);
    // когорта позавчерашнего дня: один вернулся вчера (D1), второй — нет
    const a = await login(19011, {
      createdAt: new Date(dayStart(twoDaysAgo).getTime() + 1000),
      balance: 700,
    });
    const b = await login(19012, {
      createdAt: new Date(dayStart(twoDaysAgo).getTime() + 2000),
      balance: 300,
    });
    await prisma.userActivity.createMany({
      data: [
        { userId: a.id, dayKey: twoDaysAgo },
        { userId: a.id, dayKey: yesterday },
        { userId: b.id, dayKey: twoDaysAgo },
      ],
    });
    await prisma.userActivity.deleteMany({ where: { userId: b.id, dayKey: today } });
    await prisma.referral.create({ data: { inviterId: a.id, inviteeId: b.id } });
    await login(19013, { suspiciousScore: 5 });

    const res = await admin().get('/api/admin/stats');
    expect(res.statusCode).toBe(200);
    const s = res.json<AdminStats>();
    expect(s.players).toBe(4);
    expect(s.newToday).toBe(2); // админ и 19013
    expect(s.dau).toBe(3);
    expect(s.wau).toBe(4);
    expect(s.retention.d1).toBe(0.5);
    expect(s.retention.d7).toBeNull();
    expect(s.coins.balance).toBe(1_000);
    expect(s.suspicious).toBe(1);
    expect(s.days).toHaveLength(14);
    expect(s.days.at(-1)).toMatchObject({ dayKey: today, active: 3, registered: 2 });
    expect(s.days.at(-3)).toMatchObject({ dayKey: twoDaysAgo, active: 2, registered: 2 });
    expect(s.topReferrers).toEqual([{ id: a.id, name: 'Cat19011', username: 'cat19011', friends: 1 }]);
  });

  it('cards: preview, create, edit (players see it), validation and safe delete', async () => {
    await login(ADMIN_ID);
    const list = (await admin().get('/api/admin/cards')).json<{ cards: AdminCard[] }>().cards;
    expect(list.length).toBeGreaterThanOrEqual(60);

    const preview = await admin().post('/api/admin/cards/preview', { id: 'test_ex', card: newCard });
    const p = preview.json<CardPreviewResponse>();
    expect(p.levels).toHaveLength(20);
    expect(p.levels[0]).toMatchObject({ level: 1, cost: 1_000, profit: 150, totalProfit: 150 });
    expect(p.levels[0]!.paybackHours).toBeCloseTo(6.67, 1);
    const bad = await admin().post('/api/admin/cards/preview', {
      id: 'test_ex',
      card: { ...newCard, costMultiplier: 3 },
    });
    expect(bad.json<CardPreviewResponse>().warnings.join(' ')).toContain('costMultiplier');

    // по очереди: лимит частоты запросов админки не должен влиять на проверку
    const invalid = [
      { id: 'test_ex', card: { ...newCard, icon: 'logo/none/0' } },
      { id: 'test_ex', card: { ...newCard, icon: 'token/bad ticker/0' } },
      { id: 'test_ex', card: { ...newCard, starsPrice: 0 } },
      { id: 'Bad Id', card: newCard },
      { id: 'test_ex', card: { ...newCard, condition: { type: 'card', cardId: 'test_ex', level: 1 } } },
      { id: 'test_ex', card: { ...newCard, condition: { type: 'card', cardId: 'nope', level: 1 } } },
      { id: 'doge', card: newCard },
    ];
    const codes: number[] = [];
    for (const body of invalid) codes.push((await admin().post('/api/admin/cards', body)).statusCode);
    expect(codes).toEqual([400, 400, 400, 400, 400, 400, 409]);

    expect((await admin().post('/api/admin/cards', { id: 'test_ex', card: newCard })).statusCode).toBe(200);
    const edited = await admin().put('/api/admin/cards/test_ex', { ...newCard, nameRu: 'Новая биржа' });
    expect(edited.json<{ card: AdminCard }>().card).toMatchObject({ id: 'test_ex', nameRu: 'Новая биржа' });

    await login(19021, { balance: 10_000 });
    const player = client(app, tgUser(19021));
    const cards = (await player.get('/api/cards')).json<CardsResponse>().cards;
    expect(cards.find((c) => c.id === 'test_ex')?.name).toEqual({ ru: 'Новая биржа', en: 'Test chain' });
    expect((await player.post('/api/cards/test_ex/upgrade')).statusCode).toBe(200);

    const del = await admin().del('/api/admin/cards/test_ex');
    expect(del.json<ApiErrorBody>().error.code).toBe('CONFLICT');
    const priced = await admin().post('/api/admin/cards', {
      id: 'test_ex2',
      card: { ...newCard, starsPrice: 15 },
    });
    expect(priced.json<{ card: AdminCard }>().card).toMatchObject({ starsPrice: 15, rarity: 'common' });
    expect((await admin().del('/api/admin/cards/test_ex2')).statusCode).toBe(200);
  });

  it('players: search, details with the ledger, credit with reason, ban and unban', async () => {
    const admUser = await login(ADMIN_ID);
    const p = await login(19031, { balance: 500, totalEarned: 500, suspiciousScore: 4 });

    const byName = (await admin().get('/api/admin/players?q=@cat1903')).json<{ players: AdminPlayerRow[] }>();
    expect(byName.players.map((x) => x.id)).toEqual([p.id]);
    const byTg = (await admin().get('/api/admin/players?q=19031')).json<{ players: AdminPlayerRow[] }>();
    expect(byTg.players[0]?.id).toBe(p.id);
    const sus = (await admin().get('/api/admin/suspicious')).json<{ players: AdminPlayerRow[] }>();
    expect(sus.players.map((x) => x.id)).toEqual([p.id]);

    const credit = await admin().post(`/api/admin/players/${p.id}/credit`, {
      amount: 1_500,
      reason: 'Компенсация',
    });
    const d = credit.json<AdminPlayerDetails>();
    expect(d.balance).toBe(2_000);
    expect(d.transactions[0]).toMatchObject({
      type: 'admin_adjustment',
      amount: 1_500,
      meta: { admin: String(ADMIN_ID), reason: 'Компенсация' },
    });
    const tooMuch = await admin().post(`/api/admin/players/${p.id}/credit`, {
      amount: -5_000,
      reason: 'Ошибка',
    });
    expect(tooMuch.json<ApiErrorBody>().error.code).toBe('INSUFFICIENT_FUNDS');
    expect(
      (await admin().post(`/api/admin/players/${p.id}/credit`, { amount: 0, reason: 'zero' })).statusCode,
    ).toBe(400);
    expect(
      (await admin().post(`/api/admin/players/${p.id}/credit`, { amount: 10, reason: '' })).statusCode,
    ).toBe(400);

    const ban = await admin().post(`/api/admin/players/${p.id}/ban`, { reason: 'Автокликер' });
    expect(ban.json<AdminPlayerDetails>()).toMatchObject({ isBanned: true, banReason: 'Автокликер' });
    const blocked = await client(app, tgUser(19031)).get('/api/state');
    expect(blocked.json<ApiErrorBody>().error).toMatchObject({
      code: 'BANNED',
      details: { reason: 'Автокликер' },
    });
    // начислить можно и заблокированному (например, вернуть списанное по ошибке)
    expect(
      (await admin().post(`/api/admin/players/${p.id}/credit`, { amount: 1, reason: 'test' })).statusCode,
    ).toBe(200);
    expect((await admin().post(`/api/admin/players/${admUser.id}/ban`, { reason: 'self' })).statusCode).toBe(
      400,
    );

    const unban = await admin().post(`/api/admin/players/${p.id}/unban`);
    expect(unban.json<AdminPlayerDetails>()).toMatchObject({
      isBanned: false,
      banReason: null,
      suspiciousScore: 0,
    });
    expect((await client(app, tgUser(19031)).get('/api/state')).statusCode).toBe(200);
    expect((await admin().get('/api/admin/players/999999')).statusCode).toBe(404);
  });

  it('player ledger is paginated', async () => {
    await login(ADMIN_ID);
    const p = await login(19041);
    await prisma.transaction.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        userId: p.id,
        type: 'daily_reward',
        amount: i + 1,
        balanceAfter: i + 1,
      })),
    });
    const first = (await admin().get(`/api/admin/players/${p.id}`)).json<AdminPlayerDetails>();
    expect(first.transactions).toHaveLength(50);
    expect(first.nextBefore).not.toBeNull();
    const second = (
      await admin().get(`/api/admin/players/${p.id}?before=${first.nextBefore}`)
    ).json<AdminPlayerDetails>();
    expect(second.transactions).toHaveLength(10);
    expect(second.nextBefore).toBeNull();
  });

  it('broadcasts: validation, audience, batches with progress, pause/resume, blocked users', async () => {
    await login(ADMIN_ID);
    for (let i = 0; i < 5; i++) await login(19050 + i);
    await prisma.user.update({ where: { telegramId: 19054n }, data: { settings: { notifications: false } } });
    await prisma.user.update({ where: { telegramId: 19053n }, data: { allowsWriteToPm: false } });

    const invalid = await Promise.all([
      admin().post('/api/admin/broadcasts', { text: '' }),
      admin().post('/api/admin/broadcasts', {
        text: 'x'.repeat(1100),
        imageUrl: 'https://example.com/a.png',
      }),
      admin().post('/api/admin/broadcasts', { text: 'hi', buttonText: 'Go' }),
      admin().post('/api/admin/broadcasts', { text: 'hi', buttonText: 'Go', buttonUrl: 'http://x.com' }),
    ]);
    expect(invalid.map((r) => r.statusCode)).toEqual([400, 400, 400, 400]);

    const created = await admin().post('/api/admin/broadcasts', {
      text: 'Новое обновление!',
      imageUrl: 'https://example.com/banner.png',
      buttonText: 'Играть',
      buttonUrl: 'https://t.me/meowgul_bot/app',
    });
    const id = created.json<{ broadcast: AdminBroadcast }>().broadcast.id;
    const started = (await admin().post(`/api/admin/broadcasts/${id}/start`)).json<{
      broadcast: AdminBroadcast;
    }>();
    // админ + 19050..19052; 19053 не разрешил писать, 19054 выключил уведомления
    expect(started.broadcast).toMatchObject({ status: 'RUNNING', total: 4 });
    expect((await admin().post(`/api/admin/broadcasts/${id}/start`)).statusCode).toBe(409);

    const sent: Array<{ chatId: number; imageUrl?: string; button?: unknown }> = [];
    const g: TelegramGateway = {
      channelMembership: async () => 'member',
      sendMessage: async (chatId, _text, button, opts) => {
        if (chatId === 19051)
          throw new TelegramSendError('Forbidden: bot was blocked by the user', 'blocked');
        sent.push({ chatId, imageUrl: opts?.imageUrl, button });
      },
    };
    // по возрастанию id: админ, 19050, 19051 (заблокировал бота)
    expect(await processBroadcasts(g, 3)).toMatchObject({ sent: 2, failed: 1 });
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 19051n } })).allowsWriteToPm).toBe(
      false,
    );

    await admin().post(`/api/admin/broadcasts/${id}/pause`);
    expect(await processBroadcasts(g, 10)).toMatchObject({ sent: 0 });
    await admin().post(`/api/admin/broadcasts/${id}/resume`);
    expect(await processBroadcasts(g, 10)).toMatchObject({ sent: 1 });
    await processBroadcasts(g, 10);
    const list = (await admin().get('/api/admin/broadcasts')).json<{ broadcasts: AdminBroadcast[] }>();
    expect(list.broadcasts[0]).toMatchObject({ id, status: 'DONE', sent: 3, failed: 1, total: 4 });
    expect(sent.map((s) => s.chatId).sort()).toEqual([19050, 19052, ADMIN_ID].sort());
    expect(sent[0]).toMatchObject({
      imageUrl: 'https://example.com/banner.png',
      button: { text: 'Играть', url: 'https://t.me/meowgul_bot/app' },
    });
    expect((await admin().post(`/api/admin/broadcasts/${id}/pause`)).statusCode).toBe(409);
  });

  it('broadcast waits on Telegram rate limit without skipping anyone', async () => {
    await login(ADMIN_ID);
    await login(19061);
    const created = await admin().post('/api/admin/broadcasts', { text: 'hi' });
    const id = created.json<{ broadcast: AdminBroadcast }>().broadcast.id;
    await admin().post(`/api/admin/broadcasts/${id}/start`);
    let limited = true;
    const g: TelegramGateway = {
      channelMembership: async () => 'member',
      sendMessage: async () => {
        if (limited) throw new TelegramSendError('Too Many Requests', 'rate_limited', 7);
      },
    };
    expect(await processBroadcasts(g, 10)).toMatchObject({ sent: 0, retryAfterSec: 7 });
    limited = false;
    expect(await processBroadcasts(g, 10)).toMatchObject({ sent: 2 });
  });

  it('settings: maintenance keeps admins in, happy hour and golden coin are validated', async () => {
    await login(ADMIN_ID);
    await login(19071);
    const on = await admin().put('/api/admin/settings', {
      maintenance: { enabled: true, message: 'Обновляем' },
    });
    expect(on.json<AdminSettings>().maintenance).toEqual({ enabled: true, message: 'Обновляем' });
    const player = await client(app, tgUser(19071)).get('/api/state');
    expect(player.json<ApiErrorBody>().error).toMatchObject({ code: 'MAINTENANCE', message: 'Обновляем' });
    expect((await admin().get('/api/admin/stats')).statusCode).toBe(200);
    await admin().put('/api/admin/settings', { maintenance: { enabled: false, message: '' } });
    expect((await client(app, tgUser(19071)).get('/api/state')).statusCode).toBe(200);

    const start = new Date(Date.now() + 3_600_000);
    const hh = await admin().put('/api/admin/settings', {
      happyHour: {
        auto: false,
        override: {
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
          multiplier: 3,
        },
      },
      goldenCoin: { enabled: true },
    });
    expect(hh.json<AdminSettings>()).toMatchObject({
      goldenCoin: { enabled: true },
      nextHappyHour: { startsAt: start.getTime(), multiplier: 3 },
    });
    const bad = await Promise.all([
      admin().put('/api/admin/settings', {
        happyHour: {
          auto: true,
          override: { startsAt: start.toISOString(), endsAt: start.toISOString(), multiplier: 2 },
        },
      }),
      admin().put('/api/admin/settings', {
        happyHour: {
          auto: true,
          override: {
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
            multiplier: 50,
          },
        },
      }),
      admin().put('/api/admin/settings', { minClientVersion: 'latest' }),
      admin().put('/api/admin/settings', { unknown: true }),
    ]);
    expect(bad.map((r) => r.statusCode)).toEqual([400, 400, 400, 400]);
  });

  it('daily: the week ahead is filled with auto combos and ciphers', async () => {
    await login(ADMIN_ID);
    const { days } = (await admin().get('/api/admin/daily')).json<{
      days: Array<{ dayKey: string; combo: { cardIds: string[]; source: string }; cipher: { word: string } }>;
    }>();
    expect(days).toHaveLength(7);
    for (const d of days) {
      expect(d.combo.cardIds).toHaveLength(3);
      expect(d.combo.source).toBe('auto');
      expect(d.cipher.word).toMatch(/^[A-Z]{4,7}$/);
    }
    expect(await prisma.dailyCombo.count()).toBe(7);
  });
});
