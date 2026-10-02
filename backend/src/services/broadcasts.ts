import type { AdminBroadcast } from '@meowgul/shared';
import { Prisma, type Broadcast } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { TelegramSendError, telegram, type TelegramGateway } from './telegram.js';
import type { Tx } from './userLock.js';

/**
 * Кому уходит рассылка: разрешили боту писать, не заблокированы и не выключили уведомления
 * (нет ключа notifications в настройках — значит, включены).
 */
const AUDIENCE_SQL = Prisma.sql`"allowsWriteToPm" AND NOT "isBanned" AND COALESCE(settings->>'notifications', 'true') <> 'false'`;

export async function broadcastAudienceCount(db: Tx | typeof prisma = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "User" WHERE ${AUDIENCE_SQL}`;
  return Number(rows[0]?.n ?? 0);
}

async function audienceAfter(db: Tx, cursor: number, take: number) {
  return db.$queryRaw<{ id: number; telegramId: bigint }[]>`
    SELECT id, "telegramId" FROM "User" WHERE ${AUDIENCE_SQL} AND id > ${cursor} ORDER BY id LIMIT ${take}`;
}

export function broadcastView(b: Broadcast): AdminBroadcast {
  return {
    id: b.id,
    text: b.text,
    imageUrl: b.imageUrl,
    buttonText: b.buttonText,
    buttonUrl: b.buttonUrl,
    status: b.status,
    total: b.total,
    sent: b.sent,
    failed: b.failed,
    createdAt: b.createdAt.getTime(),
    startedAt: b.startedAt?.getTime() ?? null,
    finishedAt: b.finishedAt?.getTime() ?? null,
  };
}

export function broadcastButton(b: Pick<Broadcast, 'buttonText' | 'buttonUrl'>) {
  return b.buttonText && b.buttonUrl ? { text: b.buttonText, url: b.buttonUrl } : undefined;
}

export interface BroadcastTick {
  sent: number;
  failed: number;
  /** Telegram попросил подождать, сек */
  retryAfterSec: number;
}

/**
 * Отправить очередную порцию запущенной рассылки (не больше budget сообщений).
 * Позиция (cursor — id последнего игрока) сохраняется после каждого сообщения: рассылку можно
 * приостановить и продолжить, она переживает перезапуск сервера. Несколько процессов не берут
 * одну рассылку одновременно (SKIP LOCKED).
 */
export async function processBroadcasts(
  gateway: TelegramGateway = telegram(),
  budget = 25,
): Promise<BroadcastTick> {
  const result: BroadcastTick = { sent: 0, failed: 0, retryAfterSec: 0 };
  if (budget <= 0) return result;
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Broadcast" WHERE status = 'RUNNING' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return;
      const b = await tx.broadcast.findUniqueOrThrow({ where: { id: rows[0].id } });
      const users = await audienceAfter(tx, b.cursor, budget);
      if (users.length === 0) {
        await tx.broadcast.update({ where: { id: b.id }, data: { status: 'DONE', finishedAt: new Date() } });
        logger.info({ broadcastId: b.id, sent: b.sent, failed: b.failed }, 'broadcast finished');
        return;
      }
      for (const u of users) {
        try {
          await gateway.sendMessage(Number(u.telegramId), b.text, broadcastButton(b), {
            imageUrl: b.imageUrl ?? undefined,
          });
          result.sent++;
          await tx.broadcast.update({ where: { id: b.id }, data: { cursor: u.id, sent: { increment: 1 } } });
        } catch (err) {
          if (err instanceof TelegramSendError && err.kind === 'rate_limited') {
            // этот игрок получит сообщение после паузы — cursor не сдвигаем
            result.retryAfterSec = Math.max(1, err.retryAfterSec);
            break;
          }
          result.failed++;
          await tx.broadcast.update({
            where: { id: b.id },
            data: { cursor: u.id, failed: { increment: 1 } },
          });
          if (err instanceof TelegramSendError && err.kind === 'blocked') {
            await tx.user.update({ where: { id: u.id }, data: { allowsWriteToPm: false } });
          }
        }
      }
    },
    { timeout: 60_000 },
  );
  return result;
}
