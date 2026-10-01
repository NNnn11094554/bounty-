import type { User } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';

/** Игрок, от имени которого пришёл запрос (initData уже проверен хуком). */
export async function requirePlayer(request: FastifyRequest): Promise<User> {
  if (!request.tg) throw new ApiError('UNAUTHORIZED', 'Missing Telegram init data');
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(request.tg.user.id) } });
  if (!user) throw new ApiError('UNAUTHORIZED', 'Player not registered, call /api/auth first');
  if (user.isBanned) throw new ApiError('BANNED', 'Account is banned', { reason: user.banReason });
  return user;
}

/** Администратор (ADMIN_TELEGRAM_IDS) — для маршрутов /api/admin/*. */
export async function requireAdmin(request: FastifyRequest): Promise<User> {
  const user = await requirePlayer(request);
  if (!env.adminIds.has(user.telegramId)) throw new ApiError('FORBIDDEN', 'Admins only');
  return user;
}
