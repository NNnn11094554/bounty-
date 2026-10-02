import type { TaskCheckResponse, TaskStartResponse, TasksResponse } from '@meowgul/shared';
import type { Task, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/db.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { friendsCount, listTasks, taskView } from '../services/tasks.js';
import { TelegramUnavailableError, telegram } from '../services/telegram.js';
import { withUserLock, type Tx } from '../services/userLock.js';

const Params = z.object({ id: z.string().regex(/^[a-z0-9_]{1,64}$/) });

async function activeTask(id: string): Promise<Task> {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || !task.isActive) throw new ApiError('NOT_FOUND', 'Task not found');
  return task;
}

/** Проверки, которые не требуют блокировки игрока (внешний запрос к Telegram — до транзакции). */
async function checkExternal(task: Task, user: User): Promise<void> {
  if (task.type !== 'TELEGRAM_CHANNEL') return;
  if (!task.channelId) throw new ApiError('UNAVAILABLE', 'Channel is not configured');
  try {
    const status = await telegram().channelMembership(task.channelId, Number(user.telegramId));
    if (status !== 'member') throw new ApiError('NOT_COMPLETED', 'Not subscribed to the channel');
  } catch (err) {
    if (err instanceof TelegramUnavailableError) {
      throw new ApiError('UNAVAILABLE', 'Subscription check is temporarily unavailable');
    }
    throw err;
  }
}

/** Проверки по данным игры — внутри блокировки. */
async function checkInternal(tx: Tx, task: Task, user: User, now: Date): Promise<void> {
  switch (task.type) {
    case 'LINK':
    case 'VIDEO': {
      const started = await tx.userTask.findUnique({
        where: { userId_taskId: { userId: user.id, taskId: task.id } },
      });
      if (!started) throw new ApiError('NOT_COMPLETED', 'Open the link first');
      const until = started.startedAt.getTime() + task.checkDelaySec * 1000;
      if (now.getTime() < until) throw new ApiError('COOLDOWN', 'Check is not available yet', { until });
      return;
    }
    case 'INVITE_FRIENDS': {
      const required = task.requiredCount ?? 1;
      const current = await friendsCount(tx, user.id);
      if (current < required) {
        throw new ApiError('NOT_COMPLETED', 'Not enough friends', { current, required });
      }
      return;
    }
    case 'CHOOSE_HQ':
      if (!user.hqId) throw new ApiError('NOT_COMPLETED', 'Headquarters is not chosen');
      return;
    case 'CONNECT_WALLET':
      if (!user.walletAddress) throw new ApiError('NOT_COMPLETED', 'Wallet is not connected');
      return;
    case 'TELEGRAM_CHANNEL':
      return;
  }
}

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tasks', async (request): Promise<TasksResponse> => {
    const user = await requirePlayer(request);
    const now = new Date();
    return { tasks: await listTasks(user, now), serverTime: now.getTime() };
  });

  /** Игрок перешёл по ссылке задания: запоминаем время, проверка станет доступна через checkDelaySec. */
  app.post('/api/tasks/:id/start', async (request): Promise<TaskStartResponse> => {
    const { id } = Params.parse(request.params);
    const user = await requirePlayer(request);
    const task = await activeTask(id);
    const now = new Date();
    const userTask = await prisma.userTask.upsert({
      where: { userId_taskId: { userId: user.id, taskId: task.id } },
      create: { userId: user.id, taskId: task.id, status: 'PENDING', startedAt: now },
      update: {},
    });
    const friends = await friendsCount(prisma, user.id);
    return { task: taskView(task, userTask, { friends, now, walletConnected: Boolean(user.walletAddress) }) };
  });

  app.post(
    '/api/tasks/:id/check',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request): Promise<TaskCheckResponse> => {
      const { id } = Params.parse(request.params);
      const player = await requirePlayer(request);
      const task = await activeTask(id);
      const already = await prisma.userTask.findUnique({
        where: { userId_taskId: { userId: player.id, taskId: task.id } },
      });
      if (already?.status === 'DONE') throw new ApiError('ALREADY_DONE', 'Task is already completed');
      await checkExternal(task, player);

      return withUserLock(player.id, async (tx, locked) => {
        const now = new Date();
        const { user } = await syncPassive(tx, locked, now);
        const current = await tx.userTask.findUnique({
          where: { userId_taskId: { userId: user.id, taskId: task.id } },
        });
        if (current?.status === 'DONE') throw new ApiError('ALREADY_DONE', 'Task is already completed');
        await checkInternal(tx, task, user, now);
        const reward = Number(task.reward);
        const updated = await applyBalanceChanges(
          tx,
          user,
          [{ type: 'task_reward', amount: reward, meta: { taskId: task.id } }],
          {},
          now,
        );
        const done = await tx.userTask.upsert({
          where: { userId_taskId: { userId: user.id, taskId: task.id } },
          create: { userId: user.id, taskId: task.id, status: 'DONE', startedAt: now, completedAt: now },
          update: { status: 'DONE', completedAt: now },
        });
        const friends = await friendsCount(tx, user.id);
        return {
          state: buildPlayerState(updated, now),
          task: taskView(task, done, { friends, now, walletConnected: Boolean(user.walletAddress) }),
          reward,
        };
      });
    },
  );
}
