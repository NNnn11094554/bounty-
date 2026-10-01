import type { Prisma, User } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { ApiError } from '../lib/errors.js';

export type Tx = Prisma.TransactionClient;

/**
 * Выполнить fn в транзакции БД с блокировкой строки игрока (SELECT … FOR UPDATE):
 * параллельные запросы одного игрока (двойной клик, повтор) выполняются строго по очереди.
 */
export async function withUserLock<T>(userId: number, fn: (tx: Tx, user: User) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<
        { id: number }[]
      >`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (locked.length === 0) throw new ApiError('UNAUTHORIZED', 'Player not found');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.isBanned) throw new ApiError('BANNED', 'Account is banned', { reason: user.banReason });
      return fn(tx, user);
    },
    { maxWait: 5_000, timeout: 15_000, isolationLevel: 'ReadCommitted' },
  );
}
