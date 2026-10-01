import { TASK_ICONS, TASK_SECTIONS, TASK_TYPES, type AdminTask } from '@meowgul/shared';
import type { Task } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DEFAULT_CHECK_DELAY_SEC } from '../../game/config/tasks.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import { requireAdmin } from '../../services/player.js';

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith('https://'), 'Only https:// links are allowed');

const TaskBody = z
  .object({
    type: z.enum(TASK_TYPES),
    section: z.enum(TASK_SECTIONS).default('LIST'),
    titleRu: z.string().trim().min(1).max(80),
    titleEn: z.string().trim().min(1).max(80),
    descRu: z.string().trim().max(300).default(''),
    descEn: z.string().trim().max(300).default(''),
    icon: z.enum(TASK_ICONS).default('star'),
    imageUrl: httpsUrl.nullable().default(null),
    url: httpsUrl.nullable().default(null),
    channelId: z
      .string()
      .trim()
      .regex(/^(@[A-Za-z0-9_]{5,32}|-100\d{5,15})$/, 'Channel: @username or -100…')
      .nullable()
      .default(null),
    requiredCount: z.number().int().min(1).max(1000).nullable().default(null),
    reward: z.number().int().min(0).max(1_000_000_000_000),
    checkDelaySec: z.number().int().min(0).max(3600).default(DEFAULT_CHECK_DELAY_SEC),
    sortOrder: z.number().int().min(-1000).max(10_000).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((t, ctx) => {
    const need = (field: 'url' | 'channelId' | 'requiredCount', message: string) => {
      if (t[field] === null) ctx.addIssue({ code: 'custom', path: [field], message });
    };
    if (t.type === 'TELEGRAM_CHANNEL') {
      need('channelId', 'Channel task needs channelId');
      need('url', 'Channel task needs a link to the channel');
    }
    if (t.type === 'LINK' || t.type === 'VIDEO') need('url', 'Link task needs url');
    if (t.type === 'INVITE_FRIENDS') need('requiredCount', 'Invite task needs requiredCount');
  });

const CreateBody = z.intersection(z.object({ id: z.string().regex(/^[a-z0-9_]{2,40}$/) }), TaskBody);
const Params = z.object({ id: z.string().regex(/^[a-z0-9_]{1,64}$/) });

function toAdmin(task: Task, completed: number): AdminTask {
  return {
    id: task.id,
    type: task.type,
    section: task.section,
    titleRu: task.titleRu,
    titleEn: task.titleEn,
    descRu: task.descRu,
    descEn: task.descEn,
    icon: (TASK_ICONS as readonly string[]).includes(task.icon) ? (task.icon as AdminTask['icon']) : 'star',
    imageUrl: task.imageUrl,
    url: task.url,
    channelId: task.channelId,
    requiredCount: task.requiredCount,
    reward: Number(task.reward),
    checkDelaySec: task.checkDelaySec,
    sortOrder: task.sortOrder,
    isActive: task.isActive,
    completed,
  };
}

async function completedCounts(): Promise<Map<string, number>> {
  const rows = await prisma.userTask.groupBy({ by: ['taskId'], where: { status: 'DONE' }, _count: true });
  return new Map(rows.map((r) => [r.taskId, r._count]));
}

/** CRUD заданий для админки. */
export async function adminTaskRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/tasks', async (request): Promise<{ tasks: AdminTask[] }> => {
    await requireAdmin(request);
    const [tasks, counts] = await Promise.all([
      prisma.task.findMany({ orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      completedCounts(),
    ]);
    return { tasks: tasks.map((t) => toAdmin(t, counts.get(t.id) ?? 0)) };
  });

  app.post('/api/admin/tasks', async (request): Promise<{ task: AdminTask }> => {
    await requireAdmin(request);
    const body = CreateBody.parse(request.body);
    if (await prisma.task.findUnique({ where: { id: body.id } })) {
      throw new ApiError('CONFLICT', 'Task with this id already exists');
    }
    const task = await prisma.task.create({ data: { ...body, reward: BigInt(body.reward) } });
    request.log.warn({ admin: request.tg?.user.id, taskId: task.id }, 'admin: task created');
    return { task: toAdmin(task, 0) };
  });

  app.put('/api/admin/tasks/:id', async (request): Promise<{ task: AdminTask }> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const body = TaskBody.parse(request.body);
    const exists = await prisma.task.findUnique({ where: { id } });
    if (!exists) throw new ApiError('NOT_FOUND', 'Task not found');
    const task = await prisma.task.update({ where: { id }, data: { ...body, reward: BigInt(body.reward) } });
    request.log.warn({ admin: request.tg?.user.id, taskId: id }, 'admin: task updated');
    const counts = await completedCounts();
    return { task: toAdmin(task, counts.get(id) ?? 0) };
  });

  /** Удаление: если задание уже кто-то выполнил — только выключаем, чтобы не потерять историю. */
  app.delete('/api/admin/tasks/:id', async (request): Promise<{ result: 'deleted' | 'deactivated' }> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw new ApiError('NOT_FOUND', 'Task not found');
    const completed = await prisma.userTask.count({ where: { taskId: id, status: 'DONE' } });
    request.log.warn({ admin: request.tg?.user.id, taskId: id, completed }, 'admin: task removed');
    if (completed > 0) {
      await prisma.task.update({ where: { id }, data: { isActive: false } });
      return { result: 'deactivated' };
    }
    await prisma.task.delete({ where: { id } });
    return { result: 'deleted' };
  });
}
