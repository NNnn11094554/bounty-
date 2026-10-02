import type { AuthResponse, StateResponse, TasksResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import type { Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBot } from '../src/bot/bot.js';
import { getBot, webhookSecret } from '../src/bot/runtime.js';
import { BOT_TEXTS } from '../src/bot/texts.js';
import { dayKey } from '../src/game/dayKey.js';
import { prisma } from '../src/lib/db.js';
import {
  announceDailyCombo,
  NOTIFY,
  processNotificationQueue,
  scanEnergyReminders,
} from '../src/services/notifications.js';
import { seedTasks } from '../src/services/tasks.js';
import { TelegramSendError, type TelegramGateway } from '../src/services/telegram.js';
import { authHeader, client, createApp, resetDb, tgUser } from './helpers.js';

const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'Meowgul',
  username: 'meowgul_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: true,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

/** Перехват исходящих запросов бота: ничего не уходит в Telegram, ответы — правдоподобные. */
function recorder(calls: ApiCall[], failPhoto = false): Transformer {
  return async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    if (method === 'sendPhoto' && failPhoto) throw new Error('photo unavailable');
    const message = {
      message_id: calls.length,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: 'private', first_name: 'x' },
      ...(method === 'sendPhoto'
        ? { photo: [{ file_id: 'photo-file-id', file_unique_id: 'u', width: 1, height: 1 }] }
        : {}),
    };
    return { ok: true, result: message } as never;
  };
}

function startUpdate(userId: number, text: string, language = 'ru') {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private' as const, first_name: 'Мурка' },
      from: { id: userId, is_bot: false, first_name: 'Мурка', language_code: language },
      text,
      entities: [{ type: 'bot_command' as const, offset: 0, length: 6 }],
    },
  };
}

describe('bot', () => {
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

  it('/start ref_<id> greets with a photo and a Play link that keeps the referral', async () => {
    const calls: ApiCall[] = [];
    const bot = createBot('1:test', BOT_INFO);
    bot.api.config.use(recorder(calls));
    await bot.handleUpdate(startUpdate(15001, '/start ref_777'));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('sendPhoto');
    expect(String(calls[0]!.payload.caption)).toContain('<b>Мяу, Мурка!</b>');
    expect(calls[0]!.payload.parse_mode).toBe('HTML');
    expect(String(calls[0]!.payload.photo)).toContain('/assets/generated/welcome.jpg');
    const markup = JSON.stringify(calls[0]!.payload.reply_markup);
    expect(markup).toContain('startapp=ref_777');
  });

  it('/start without a referral opens the Mini App; falls back to text without the photo', async () => {
    const calls: ApiCall[] = [];
    const bot = createBot('1:test', BOT_INFO);
    bot.api.config.use(recorder(calls, true));
    await client(app, tgUser(15002, { allows_write_to_pm: false })).post('/api/auth');
    await bot.handleUpdate(startUpdate(15002, '/start', 'en'));
    expect(calls.map((c) => c.method)).toEqual(['sendPhoto', 'sendMessage']);
    expect(String(calls[1]!.payload.text)).toContain('<b>Meow, Мурка!</b>');
    expect(calls[1]!.payload.parse_mode).toBe('HTML');
    expect(JSON.stringify(calls[1]!.payload.reply_markup)).toContain('web_app');
    // написал боту — уведомления разрешены
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 15002n } });
    expect(user.allowsWriteToPm).toBe(true);
  });

  it('welcome escapes the player name for HTML', () => {
    const text = BOT_TEXTS.ru.welcome('<Кот & Ко>');
    expect(text).toContain('<b>Мяу, &lt;Кот &amp; Ко&gt;!</b>');
    expect(BOT_TEXTS.ru.welcome('Мурка')).toMatch(/6\s000\s000/);
  });

  it('webhook secret uses only characters Telegram accepts', () => {
    expect(webhookSecret()).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
  });

  it('webhook accepts updates only with the secret', async () => {
    const calls: ApiCall[] = [];
    const bot = getBot();
    bot.botInfo = BOT_INFO;
    bot.api.config.use(recorder(calls));
    const bad = await app.inject({
      method: 'POST',
      url: '/api/bot/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
      payload: startUpdate(15003, '/start'),
    });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/bot/webhook',
      headers: { 'x-telegram-bot-api-secret-token': webhookSecret() },
      payload: startUpdate(15003, '/start'),
    });
    expect(ok.statusCode).toBe(200);
    expect(calls.some((c) => c.method === 'sendPhoto')).toBe(true);
  });
});

describe('notifications', () => {
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

  function gateway(behaviour: (chatId: number) => void = () => undefined) {
    const sent: Array<{ chatId: number; text: string }> = [];
    const g: TelegramGateway = {
      channelMembership: async () => 'member',
      sendMessage: async (chatId, text) => {
        behaviour(chatId);
        sent.push({ chatId, text });
      },
    };
    return { g, sent };
  }

  async function player(id: number, extra: Parameters<typeof prisma.user.update>[0]['data'] = {}) {
    await client(app, tgUser(id)).post('/api/auth');
    return prisma.user.update({ where: { telegramId: BigInt(id) }, data: extra });
  }

  it('a friend joining notifies the inviter in their language', async () => {
    await player(16001);
    await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: authHeader(tgUser(16002), { startParam: 'ref_16001' }),
    });
    const { g, sent } = gateway();
    const res = await processNotificationQueue(g);
    expect(res).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
    expect(sent[0]).toMatchObject({ chatId: 16001 });
    expect(sent[0]!.text).toContain('Cat16002 присоединился');
    expect(sent[0]!.text).toMatch(/\+5\s000/);
  });

  it('respects consent and at most 2 messages per game day', async () => {
    const user = await player(16003);
    const silent = await player(16004, { settings: { notifications: false } });
    const blockedPm = await player(16005, { allowsWriteToPm: false });
    for (let i = 0; i < 3; i++)
      await prisma.notification.create({ data: { userId: user.id, kind: 'energy_full' } });
    await prisma.notification.create({ data: { userId: silent.id, kind: 'energy_full' } });
    await prisma.notification.create({ data: { userId: blockedPm.id, kind: 'energy_full' } });
    const { g, sent } = gateway();
    const res = await processNotificationQueue(g);
    expect(res).toMatchObject({ sent: NOTIFY.perDay, skipped: 3 });
    expect(sent.every((m) => m.chatId === 16003)).toBe(true);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh).toMatchObject({ notifySentToday: 2, notifyDayKey: dayKey(new Date()) });
  });

  it('a blocked bot disables notifications; a rate limit pauses the queue', async () => {
    const a = await player(16006);
    const b = await player(16007);
    await prisma.notification.create({ data: { userId: a.id, kind: 'energy_full' } });
    await prisma.notification.create({ data: { userId: b.id, kind: 'energy_full' } });
    const { g } = gateway((chatId) => {
      if (chatId === 16006) throw new TelegramSendError('Forbidden: bot was blocked by the user', 'blocked');
      throw new TelegramSendError('Too Many Requests', 'rate_limited', 7);
    });
    const res = await processNotificationQueue(g);
    expect(res).toMatchObject({ sent: 0, failed: 1, retryAfterSec: 7 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).allowsWriteToPm).toBe(false);
    const pending = await prisma.notification.findMany({ where: { status: 'PENDING' } });
    expect(pending.map((n) => n.userId)).toEqual([b.id]);
  });

  it('stale notifications are skipped', async () => {
    const u = await player(16008);
    await prisma.notification.create({
      data: { userId: u.id, kind: 'energy_full', createdAt: new Date(Date.now() - NOTIFY.maxAgeMs - 1000) },
    });
    const { g, sent } = gateway();
    expect((await processNotificationQueue(g)).skipped).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('energy reminder: only for players who left with low energy and did not come back', async () => {
    const hourAgo = new Date(Date.now() - 3600_000);
    const away = await player(16009, {
      energy: 10,
      energyUpdatedAt: hourAgo,
      lastSeenAt: hourAgo,
      energyFullNotify: true,
    });
    const back = await player(16010, {
      energy: 10,
      energyUpdatedAt: hourAgo,
      lastSeenAt: new Date(),
      energyFullNotify: true,
    });
    const notYet = await player(16011, {
      energy: 10,
      energyUpdatedAt: new Date(),
      lastSeenAt: new Date(),
      energyFullNotify: true,
    });
    expect(await scanEnergyReminders()).toBe(1);
    const queued = await prisma.notification.findMany();
    expect(queued.map((n) => [n.userId, n.kind])).toEqual([[away.id, 'energy_full']]);
    const flags = await prisma.user.findMany({
      where: { id: { in: [away.id, back.id, notYet.id] } },
      orderBy: { id: 'asc' },
      select: { energyFullNotify: true },
    });
    expect(flags.map((f) => f.energyFullNotify)).toEqual([false, false, true]);
  });

  it('taps that drain the energy turn the reminder on', async () => {
    const c = client(app, tgUser(16012));
    await c.post('/api/auth');
    await prisma.user.update({
      where: { telegramId: 16012n },
      data: { energy: 150, energyUpdatedAt: new Date(), lastTapAt: new Date(Date.now() - 10_000) },
    });
    await c.post('/api/tap', { seq: 1, taps: 100 });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 16012n } });
    expect(user.energyFullNotify).toBe(true);
  });

  it('daily combo is announced once per game day to recently active players', async () => {
    await player(16013);
    await player(16014, { lastSeenAt: new Date(Date.now() - 10 * 86_400_000) });
    await player(16015, { settings: { notifications: false } });
    expect(await announceDailyCombo()).toBe(1);
    expect(await announceDailyCombo()).toBe(0);
    const queued = await prisma.notification.findMany({ include: { user: true } });
    expect(queued.map((n) => [n.user.telegramId, n.kind])).toEqual([[16013n, 'daily_combo']]);
  });
});

describe('headquarters', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    await seedTasks();
  });

  it('choosing HQ finishes onboarding and pays the task reward once', async () => {
    const c = client(app, tgUser(17001));
    const auth = (await c.post('/api/auth')).json<AuthResponse>();
    expect(auth.state.profile).toMatchObject({ onboardingDone: false, hqId: null });
    const first = (await c.post('/api/hq', { hqId: 'paw_city' })).json<StateResponse>();
    expect(first.state.profile).toMatchObject({ onboardingDone: true, hqId: 'paw_city' });
    expect(first.state.balance).toBe(5_000);
    const tasks = (await c.get('/api/tasks')).json<TasksResponse>();
    expect(tasks.tasks.find((t) => t.id === 'choose_hq')?.status).toBe('done');

    // сменить можно, но награды больше нет
    const second = (await c.post('/api/hq', { hqId: 'moon_harbor' })).json<StateResponse>();
    expect(second.state.profile.hqId).toBe('moon_harbor');
    expect(second.state.balance).toBe(5_000);
    expect((await c.post('/api/hq', { hqId: 'atlantis' })).statusCode).toBe(400);
  });
});
