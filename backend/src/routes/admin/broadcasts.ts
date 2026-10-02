import type { AdminBroadcast } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import { broadcastAudienceCount, broadcastButton, broadcastView } from '../../services/broadcasts.js';
import { requireAdmin } from '../../services/player.js';
import { TelegramSendError, telegram } from '../../services/telegram.js';

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith('https://'), 'Only https:// links are allowed');

const BroadcastBody = z
  .object({
    text: z.string().trim().min(1).max(4096),
    imageUrl: httpsUrl.nullable().default(null),
    buttonText: z.string().trim().min(1).max(40).nullable().default(null),
    buttonUrl: httpsUrl.nullable().default(null),
  })
  .superRefine((b, ctx) => {
    // подпись к фото в Telegram — не длиннее 1024 символов
    if (b.imageUrl && b.text.length > 1024) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'With an image the text is limited to 1024' });
    }
    if ((b.buttonText === null) !== (b.buttonUrl === null)) {
      ctx.addIssue({ code: 'custom', path: ['buttonUrl'], message: 'Button needs both text and link' });
    }
  });

const Params = z.object({ id: z.coerce.number().int().positive() });

async function load(id: number) {
  const b = await prisma.broadcast.findUnique({ where: { id } });
  if (!b) throw new ApiError('NOT_FOUND', 'Broadcast not found');
  return b;
}

/** Рассылки через бота: черновик → тест себе → запуск → пауза/продолжение/отмена, прогресс. */
export async function adminBroadcastRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/admin/broadcasts',
    async (request): Promise<{ broadcasts: AdminBroadcast[]; audience: number }> => {
      await requireAdmin(request);
      const [rows, audience] = await Promise.all([
        prisma.broadcast.findMany({ orderBy: { id: 'desc' }, take: 50 }),
        broadcastAudienceCount(),
      ]);
      return { broadcasts: rows.map(broadcastView), audience };
    },
  );

  app.post('/api/admin/broadcasts', async (request): Promise<{ broadcast: AdminBroadcast }> => {
    const admin = await requireAdmin(request);
    const body = BroadcastBody.parse(request.body);
    const b = await prisma.broadcast.create({ data: { ...body, createdBy: admin.telegramId } });
    return { broadcast: broadcastView(b) };
  });

  app.put('/api/admin/broadcasts/:id', async (request): Promise<{ broadcast: AdminBroadcast }> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const body = BroadcastBody.parse(request.body);
    if ((await load(id)).status !== 'DRAFT') throw new ApiError('CONFLICT', 'Only drafts can be edited');
    return { broadcast: broadcastView(await prisma.broadcast.update({ where: { id }, data: body })) };
  });

  /** Тест: отправить сообщение только себе — проверить текст, картинку и кнопку. */
  app.post('/api/admin/broadcasts/:id/test', async (request): Promise<{ ok: true }> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const b = await load(id);
    try {
      await telegram().sendMessage(Number(admin.telegramId), b.text, broadcastButton(b), {
        imageUrl: b.imageUrl ?? undefined,
      });
    } catch (err) {
      const reason = err instanceof TelegramSendError ? err.message : String(err);
      throw new ApiError('UNAVAILABLE', `Telegram: ${reason}`);
    }
    return { ok: true };
  });

  app.post('/api/admin/broadcasts/:id/start', async (request): Promise<{ broadcast: AdminBroadcast }> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const b = await load(id);
    if (b.status !== 'DRAFT') throw new ApiError('CONFLICT', 'Broadcast is already started');
    const total = await broadcastAudienceCount();
    const updated = await prisma.broadcast.update({
      where: { id },
      data: { status: 'RUNNING', total, startedAt: new Date(), cursor: 0 },
    });
    request.log.warn(
      { admin: admin.telegramId.toString(), broadcastId: id, total },
      'admin: broadcast started',
    );
    return { broadcast: broadcastView(updated) };
  });

  const transition = (path: string, from: string[], to: 'PAUSED' | 'RUNNING' | 'CANCELLED') =>
    app.post(path, async (request): Promise<{ broadcast: AdminBroadcast }> => {
      const admin = await requireAdmin(request);
      const { id } = Params.parse(request.params);
      // условное обновление: рассылка могла закончиться, пока админ нажимал кнопку
      const res = await prisma.broadcast.updateMany({
        where: { id, status: { in: from as never } },
        data: { status: to, ...(to === 'CANCELLED' ? { finishedAt: new Date() } : {}) },
      });
      if (res.count === 0) throw new ApiError('CONFLICT', `Broadcast cannot be moved to ${to} now`);
      request.log.warn(
        { admin: admin.telegramId.toString(), broadcastId: id, to },
        'admin: broadcast status',
      );
      return { broadcast: broadcastView(await load(id)) };
    });
  transition('/api/admin/broadcasts/:id/pause', ['RUNNING'], 'PAUSED');
  transition('/api/admin/broadcasts/:id/resume', ['PAUSED'], 'RUNNING');
  transition('/api/admin/broadcasts/:id/cancel', ['DRAFT', 'RUNNING', 'PAUSED'], 'CANCELLED');
}
