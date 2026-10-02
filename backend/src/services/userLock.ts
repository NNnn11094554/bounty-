import type { Prisma, User } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';

export type Tx = Prisma.TransactionClient;

/**
 * Выполнить fn в транзакции БД с блокировкой строки игрока (SELECT … FOR UPDATE):
 * параллельные запросы одного игрока (двойной клик, повтор) выполняются строго по очереди.
 */
export async function withUserLock<T>(
  userId: number,
  fn: (tx: Tx, user: User) => Promise<T>,
  opts: { allowBanned?: boolean } = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new ApiError('UNAUTHORIZED', 'Player not found');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      // операции админа (ручное начисление) допустимы и для заблокированного
      if (user.isBanned && !opts.allowBanned) {
        throw new ApiError('BANNED', 'Account is banned', { reason: user.banReason });
      }
      return fn(tx, user);
    },
    { maxWait: 5_000, timeout: 15_000, isolationLevel: 'ReadCommitted' },
  );
}

/**
 * Заблокировать строку другого игрока внутри уже открытой транзакции (бонус пригласившему).
 * Порядок блокировок всегда от нового игрока к старому (пригласивший зарегистрирован раньше), поэтому
 * взаимных блокировок не бывает.
 */
export async function lockUser(tx: Tx, userId: number): Promise<User | null> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return tx.user.findUnique({ where: { id: userId } });
}
