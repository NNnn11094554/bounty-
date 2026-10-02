import type { Task, User, UserTask } from '@prisma/client';
import { TON_WALLET_ENABLED, TASK_ICONS, type TaskIcon, type TaskView } from '@meowgul/shared';
import { env } from '../env.js';
import { builtInTasks } from '../game/config/tasks.js';
import { prisma } from '../lib/db.js';
import type { Tx } from './userLock.js';

/**
 * Создать встроенные задания, которых ещё нет. Задание канала включается, когда заданы
 * CHANNEL_ID и CHANNEL_URL; правки из админки не перезаписываются.
 */
export async function seedTasks(): Promise<number> {
  const channel = { id: env.CHANNEL_ID ?? null, url: env.CHANNEL_URL ?? null };
  const configs = builtInTasks(channel);
  const { count } = await prisma.task.createMany({
    data: configs.map((t) => ({
      ...t,
      reward: BigInt(t.reward),
      isActive: t.type !== 'TELEGRAM_CHANNEL' || Boolean(channel.id && channel.url),
    })),
    skipDuplicates: true,
  });
  // канал указали в окружении позже, чем задание появилось в БД
  if (channel.id && channel.url) {
    await prisma.task.updateMany({
      where: { type: 'TELEGRAM_CHANNEL', channelId: null, id: 'tg_channel' },
      data: { channelId: channel.id, url: channel.url, isActive: true },
    });
  }
  return count;
}

function icon(value: string): TaskIcon {
  return (TASK_ICONS as readonly string[]).includes(value) ? (value as TaskIcon) : 'star';
}

export interface TaskContext {
  friends: number;
  now: Date;
  /** у игрока подключён кошелёк — задание кошелька выполнено, пока он подключён */
  walletConnected: boolean;
}

export function taskView(task: Task, userTask: UserTask | null, ctx: TaskContext): TaskView {
  const done = task.type === 'CONNECT_WALLET' ? ctx.walletConnected : userTask?.status === 'DONE';
  const timed = task.type === 'LINK' || task.type === 'VIDEO';
  const status = done ? 'done' : userTask && task.type !== 'CONNECT_WALLET' ? 'started' : 'new';
  return {
    id: task.id,
    type: task.type,
    section: task.section,
    title: { ru: task.titleRu, en: task.titleEn },
    description: { ru: task.descRu, en: task.descEn },
    icon: icon(task.icon),
    imageUrl: task.imageUrl,
    url: task.url,
    reward: Number(task.reward),
    status,
    checkAvailableAt:
      timed && userTask && !done ? userTask.startedAt.getTime() + task.checkDelaySec * 1000 : null,
    progress:
      task.type === 'INVITE_FRIENDS' && task.requiredCount
        ? { current: Math.min(ctx.friends, task.requiredCount), required: task.requiredCount }
        : null,
  };
}

/** Задания игрока: все активные и уже выполненные (даже если их выключили). */
export async function listTasks(user: User, now: Date): Promise<TaskView[]> {
  const [tasks, progress, friends] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ isActive: true }, { users: { some: { userId: user.id, status: 'DONE' } } }] },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.userTask.findMany({ where: { userId: user.id } }),
    prisma.referral.count({ where: { inviterId: user.id } }),
  ]);
  const byTask = new Map(progress.map((p) => [p.taskId, p]));
  const walletConnected = Boolean(user.walletAddress);
  return tasks
    .filter((t) => TON_WALLET_ENABLED || t.type !== 'CONNECT_WALLET') // кошелёк временно скрыт
    .map((t) => taskView(t, byTask.get(t.id) ?? null, { friends, now, walletConnected }));
}

export async function friendsCount(db: Tx | typeof prisma, userId: number): Promise<number> {
  return db.referral.count({ where: { inviterId: userId } });
}
