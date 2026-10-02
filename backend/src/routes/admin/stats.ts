import type { AdminDayPoint, AdminStats } from '@meowgul/shared';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { env } from '../../env.js';
import { dayKey, dayStart, previousDayKey } from '../../game/dayKey.js';
import { prisma } from '../../lib/db.js';
import { toCoins } from '../../lib/money.js';
import { requireAdmin } from '../../services/player.js';

/** suspiciousScore, начиная с которого игрок попадает в список подозрительных */
export const SUSPICIOUS_THRESHOLD = 3;

/** Ключи N игровых дней, заканчивая днём last (по возрастанию). */
export function lastDays(last: string, n: number): string[] {
  const keys = [last];
  while (keys.length < n) keys.unshift(previousDayKey(keys[0]!));
  return keys;
}

async function distinctActive(keys: string[]): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT "userId") AS n FROM "UserActivity" WHERE "dayKey" IN (${Prisma.join(keys)})`;
  return Number(rows[0]?.n ?? 0);
}

/**
 * Удержание D-N: из игроков, пришедших в день когорты, доля заходивших через N дней.
 * Считаем по последнему полному дню (вчера), чтобы неполный сегодняшний день не занижал цифры.
 */
async function retention(returnDay: string, n: number): Promise<number | null> {
  const cohort = lastDays(returnDay, n + 1)[0]!;
  const from = dayStart(cohort);
  const to = new Date(from.getTime() + 86_400_000);
  const rows = await prisma.$queryRaw<{ cohort: bigint; returned: bigint }[]>`
    SELECT COUNT(*) AS cohort,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM "UserActivity" a WHERE a."userId" = u.id AND a."dayKey" = ${returnDay}
           )) AS returned
    FROM "User" u WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to}`;
  const size = Number(rows[0]?.cohort ?? 0);
  return size ? Number(rows[0]!.returned) / size : null;
}

export async function adminStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/stats', async (request): Promise<AdminStats> => {
    await requireAdmin(request);
    const now = new Date();
    const today = dayKey(now);
    const yesterday = previousDayKey(today);
    const days14 = lastDays(today, 14);
    const resetHours = env.DAILY_RESET_UTC_HOUR;

    const [players, newToday, dau, wau, mau, d1, d7, d30, coins, banned, suspicious, pending] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: dayStart(today) } } }),
        prisma.userActivity.count({ where: { dayKey: today } }),
        distinctActive(lastDays(today, 7)),
        distinctActive(lastDays(today, 30)),
        retention(yesterday, 1),
        retention(yesterday, 7),
        retention(yesterday, 30),
        prisma.user.aggregate({ _sum: { balance: true, totalEarned: true } }),
        prisma.user.count({ where: { isBanned: true } }),
        prisma.user.count({ where: { isBanned: false, suspiciousScore: { gte: SUSPICIOUS_THRESHOLD } } }),
        prisma.notification.count({ where: { status: 'PENDING' } }),
      ]);

    const [shopTotal, shopToday] = await Promise.all([
      prisma.purchase.aggregate({ where: { status: 'PAID' }, _sum: { stars: true }, _count: true }),
      prisma.purchase.aggregate({
        where: { status: 'PAID', paidAt: { gte: dayStart(today) } },
        _sum: { stars: true },
      }),
    ]);

    const [activeRows, registeredRows, referrers] = await Promise.all([
      prisma.userActivity.groupBy({ by: ['dayKey'], where: { dayKey: { in: days14 } }, _count: true }),
      prisma.$queryRaw<{ day: string; n: bigint }[]>`
        SELECT to_char("createdAt" - make_interval(hours => ${resetHours}::int), 'YYYY-MM-DD') AS day, COUNT(*) AS n
        FROM "User" WHERE "createdAt" >= ${dayStart(days14[0]!)}
        GROUP BY 1`,
      prisma.referral.groupBy({
        by: ['inviterId'],
        _count: true,
        orderBy: { _count: { inviterId: 'desc' } },
        take: 10,
      }),
    ]);
    const inviters = await prisma.user.findMany({
      where: { id: { in: referrers.map((r) => r.inviterId) } },
      select: { id: true, firstName: true, username: true },
    });
    const days: AdminDayPoint[] = days14.map((key) => ({
      dayKey: key,
      active: activeRows.find((r) => r.dayKey === key)?._count ?? 0,
      registered: Number(registeredRows.find((r) => r.day === key)?.n ?? 0),
    }));

    return {
      players,
      newToday,
      dau,
      wau,
      mau,
      retention: { d1, d7, d30 },
      coins: {
        balance: toCoins(coins._sum.balance ?? new Prisma.Decimal(0)),
        earned: toCoins(coins._sum.totalEarned ?? new Prisma.Decimal(0)),
      },
      banned,
      suspicious,
      pendingNotifications: pending,
      shop: {
        starsTotal: shopTotal._sum.stars ?? 0,
        starsToday: shopToday._sum.stars ?? 0,
        purchases: shopTotal._count,
      },
      days,
      topReferrers: referrers.map((r) => {
        const u = inviters.find((i) => i.id === r.inviterId);
        return {
          id: r.inviterId,
          name: u?.firstName || '—',
          username: u?.username ?? null,
          friends: r._count,
        };
      }),
      generatedAt: now.getTime(),
    };
  });
}
