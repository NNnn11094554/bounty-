import {
  TON_WALLET_ENABLED,
  type AdminTask,
  type ApiErrorBody,
  type TaskCheckResponse,
  type TaskStartResponse,
  type TasksResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { seedTasks } from '../src/services/tasks.js';
import {
  setTelegramGateway,
  TelegramUnavailableError,
  type MembershipStatus,
} from '../src/services/telegram.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const ADMIN_ID = 999000999;

describe('Earn tasks', () => {
  let app: FastifyInstance;
  let membership: MembershipStatus | 'error' = 'not_member';
  const calls: Array<{ channelId: string; telegramId: number }> = [];

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
    setTelegramGateway(null);
  });
  beforeEach(async () => {
    await resetDb();
    calls.length = 0;
    membership = 'not_member';
    setTelegramGateway({
      channelMembership: async (channelId, telegramId) => {
        calls.push({ channelId, telegramId });
        if (membership === 'error') throw new TelegramUnavailableError('bot is not an admin');
        return membership;
      },
      sendMessage: async () => undefined,
    });
  });
  afterEach(() => setTelegramGateway(null));

  async function createTask(
    data: Partial<Parameters<typeof prisma.task.create>[0]['data']> & { id: string },
  ) {
    return prisma.task.create({
      data: { type: 'LINK', titleRu: 'Задание', titleEn: 'Task', reward: 5000n, ...data },
    });
  }

  async function player(id: number) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(id) } });
    return { c, user };
  }

  it('built-in tasks: channel task stays off without a configured channel', async () => {
    await seedTasks();
    const tasks = await prisma.task.findMany({ orderBy: { id: 'asc' } });
    expect(tasks.map((t) => [t.id, t.isActive])).toEqual([
      ['choose_hq', true],
      ['connect_wallet', true],
      ['invite_3', true],
      ['tg_channel', false],
    ]);
    const { c } = await player(8001);
    const list = (await c.get('/api/tasks')).json<TasksResponse>();
    // задание «Подключи кошелёк» есть в базе, но скрыто, пока TON_WALLET_ENABLED = false
    expect(list.tasks.map((t) => [t.id, t.section])).toEqual([
      ['choose_hq', 'LIST'],
      ['invite_3', 'LIST'],
      ...(TON_WALLET_ENABLED ? [['connect_wallet', 'AIRDROP']] : []),
    ]);
    if (TON_WALLET_ENABLED)
      expect(list.tasks.find((t) => t.id === 'connect_wallet')).toMatchObject({ status: 'new', reward: 0 });
    expect(list.tasks.find((t) => t.id === 'invite_3')).toMatchObject({
      status: 'new',
      reward: 25_000,
      progress: { current: 0, required: 3 },
    });
  });

  it('channel subscription is checked through the Bot API', async () => {
    await createTask({
      id: 'tg_channel',
      type: 'TELEGRAM_CHANNEL',
      channelId: '@meowgul_news',
      url: 'https://t.me/meowgul_news',
      checkDelaySec: 0,
    });
    const { c, user } = await player(8002);

    const notYet = await c.post('/api/tasks/tg_channel/check');
    expect(notYet.statusCode).toBe(409);
    expect(notYet.json<ApiErrorBody>().error.code).toBe('NOT_COMPLETED');
    expect(calls).toEqual([{ channelId: '@meowgul_news', telegramId: 8002 }]);

    membership = 'error';
    const broken = await c.post('/api/tasks/tg_channel/check');
    expect(broken.statusCode).toBe(503);
    expect(broken.json<ApiErrorBody>().error.code).toBe('UNAVAILABLE');

    membership = 'member';
    const ok = await c.post('/api/tasks/tg_channel/check');
    expect(ok.statusCode).toBe(200);
    const body = ok.json<TaskCheckResponse>();
    expect(body.reward).toBe(5000);
    expect(body.state.balance).toBe(5000);
    expect(body.task.status).toBe('done');

    const again = await c.post('/api/tasks/tg_channel/check');
    expect(again.json<ApiErrorBody>().error.code).toBe('ALREADY_DONE');
    const txs = await prisma.transaction.findMany({ where: { userId: user.id, type: 'task_reward' } });
    expect(txs).toHaveLength(1);

    // задание открывает карточку с условием «подписка на канал»
    await prisma.user.update({ where: { id: user.id }, data: { balance: 1_000_000 } });
    expect((await c.post('/api/cards/sp_yarn/upgrade')).statusCode).toBe(200);
  });

  it('link tasks can be checked 30 seconds after opening', async () => {
    await createTask({
      id: 'follow_x',
      url: 'https://example.com/meowgul',
      checkDelaySec: 30,
      reward: 100_000n,
    });
    const { c, user } = await player(8003);

    const early = await c.post('/api/tasks/follow_x/check');
    expect(early.json<ApiErrorBody>().error.code).toBe('NOT_COMPLETED');

    const started = (await c.post('/api/tasks/follow_x/start')).json<TaskStartResponse>();
    expect(started.task.status).toBe('started');
    expect(started.task.checkAvailableAt).toBeGreaterThan(Date.now() + 25_000);

    const wait = await c.post('/api/tasks/follow_x/check');
    expect(wait.statusCode).toBe(409);
    expect(wait.json<ApiErrorBody>().error).toMatchObject({ code: 'COOLDOWN' });

    // повторный переход не сбрасывает таймер
    await prisma.userTask.update({
      where: { userId_taskId: { userId: user.id, taskId: 'follow_x' } },
      data: { startedAt: new Date(Date.now() - 31_000) },
    });
    await c.post('/api/tasks/follow_x/start');
    const ok = (await c.post('/api/tasks/follow_x/check')).json<TaskCheckResponse>();
    expect(ok.reward).toBe(100_000);
    expect(ok.state.balance).toBe(100_000);
  });

  it('parallel checks pay only once', async () => {
    await createTask({ id: 'video_1', type: 'VIDEO', url: 'https://example.com/v', checkDelaySec: 0 });
    const { c, user } = await player(8004);
    await c.post('/api/tasks/video_1/start');
    const results = await Promise.all([1, 2, 3].map(() => c.post('/api/tasks/video_1/check')));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance.toNumber()).toBe(5000);
  });

  it('invite friends task counts referrals', async () => {
    await seedTasks();
    const { c, user } = await player(8005);
    expect((await c.post('/api/tasks/invite_3/check')).json<ApiErrorBody>().error).toMatchObject({
      code: 'NOT_COMPLETED',
      details: { current: 0, required: 3 },
    });
    for (const id of [8101, 8102, 8103]) {
      const { user: friend } = await player(id);
      await prisma.referral.create({ data: { inviterId: user.id, inviteeId: friend.id } });
    }
    const list = (await c.get('/api/tasks')).json<TasksResponse>();
    expect(list.tasks.find((t) => t.id === 'invite_3')?.progress).toEqual({ current: 3, required: 3 });
    const ok = (await c.post('/api/tasks/invite_3/check')).json<TaskCheckResponse>();
    expect(ok.reward).toBe(25_000);
  });

  it('inactive and unknown tasks are not available, done ones stay in the list', async () => {
    await createTask({ id: 'old_link', url: 'https://example.com', checkDelaySec: 0 });
    const { c, user } = await player(8006);
    await c.post('/api/tasks/old_link/start');
    expect((await c.post('/api/tasks/old_link/check')).statusCode).toBe(200);
    await prisma.task.update({ where: { id: 'old_link' }, data: { isActive: false } });
    await createTask({ id: 'off', url: 'https://example.com', isActive: false });
    const list = (await c.get('/api/tasks')).json<TasksResponse>();
    expect(list.tasks.map((t) => [t.id, t.status])).toEqual([['old_link', 'done']]);
    expect((await c.post('/api/tasks/off/start')).statusCode).toBe(404);
    expect((await c.post('/api/tasks/nope/check')).statusCode).toBe(404);
    expect(await prisma.userTask.count({ where: { userId: user.id, status: 'DONE' } })).toBe(1);
  });

  describe('admin CRUD', () => {
    const body = {
      type: 'LINK',
      section: 'SPECIAL',
      titleRu: 'Смотри наш ролик',
      titleEn: 'Watch our clip',
      icon: 'video',
      url: 'https://example.com/clip',
      reward: 50_000,
    };

    it('only admins can manage tasks', async () => {
      const { c } = await player(8007);
      expect((await c.get('/api/admin/tasks')).statusCode).toBe(403);
      expect((await c.post('/api/admin/tasks', { id: 'x1', ...body })).json<ApiErrorBody>().error.code).toBe(
        'FORBIDDEN',
      );
    });

    it('creates, lists, updates and deletes tasks', async () => {
      const { c: admin } = await player(ADMIN_ID);
      const created = await admin.post('/api/admin/tasks', { id: 'clip_1', ...body });
      expect(created.statusCode).toBe(200);
      expect(created.json<{ task: AdminTask }>().task).toMatchObject({
        id: 'clip_1',
        section: 'SPECIAL',
        checkDelaySec: 30,
        isActive: true,
        completed: 0,
      });
      expect((await admin.post('/api/admin/tasks', { id: 'clip_1', ...body })).statusCode).toBe(409);

      const updated = await admin.put('/api/admin/tasks/clip_1', { ...body, reward: 75_000, sortOrder: 5 });
      expect(updated.json<{ task: AdminTask }>().task).toMatchObject({ reward: 75_000, sortOrder: 5 });

      const list = (await admin.get('/api/admin/tasks')).json<{ tasks: AdminTask[] }>();
      expect(list.tasks.map((t) => t.id)).toContain('clip_1');

      expect((await admin.del('/api/admin/tasks/clip_1')).json()).toEqual({ result: 'deleted' });
      expect(await prisma.task.count({ where: { id: 'clip_1' } })).toBe(0);
    });

    it('validates task fields and keeps completed tasks when deleting', async () => {
      const { c: admin } = await player(ADMIN_ID);
      const bad = [
        { id: 'a1', ...body, url: 'javascript:alert(1)' },
        { id: 'a2', ...body, url: null },
        { id: 'a3', ...body, type: 'TELEGRAM_CHANNEL', channelId: 'not a channel' },
        { id: 'a4', ...body, type: 'INVITE_FRIENDS', url: null },
        { id: 'A5!', ...body },
        { id: 'a6', ...body, reward: -1 },
      ];
      for (const payload of bad) {
        expect((await admin.post('/api/admin/tasks', payload)).statusCode).toBe(400);
      }
      await admin.post('/api/admin/tasks', { id: 'kept', ...body, checkDelaySec: 0 });
      const { c } = await player(8008);
      await c.post('/api/tasks/kept/start');
      await c.post('/api/tasks/kept/check');
      expect((await admin.del('/api/admin/tasks/kept')).json()).toEqual({ result: 'deactivated' });
      const list = (await admin.get('/api/admin/tasks')).json<{ tasks: AdminTask[] }>();
      expect(list.tasks.find((t) => t.id === 'kept')).toMatchObject({ isActive: false, completed: 1 });
    });
  });
});
