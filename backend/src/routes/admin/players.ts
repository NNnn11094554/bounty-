import type { AdminPlayerDetails, AdminPlayerRow, AdminTransaction } from '@meowgul/shared';
import type { Prisma, User } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import { toCoins } from '../../lib/money.js';
import { applyBalanceChanges } from '../../services/ledger.js';
import { clearLeaderboardCache } from '../../services/leaderboard.js';
import { requireAdmin } from '../../services/player.js';
import { friendlyAddress } from '../../services/tonProof.js';
import { withUserLock } from '../../services/userLock.js';
import { SUSPICIOUS_THRESHOLD } from './stats.js';

const Params = z.object({ id: z.coerce.number().int().positive() });
const SearchQuery = z.object({ q: z.string().trim().max(64).default('') });
const TxQuery = z.object({
  before: z
    .string()
    .regex(/^\d{1,20}$/)
    .optional(),
});
const BanBody = z.object({ reason: z.string().trim().min(3).max(300) });
const CreditBody = z.object({
  amount: z
    .number()
    .int()
    .min(-1_000_000_000_000)
    .max(1_000_000_000_000)
    .refine((n) => n !== 0, 'Amount must not be zero'),
  reason: z.string().trim().min(3).max(300),
});

const TX_PAGE = 50;

function row(u: User): AdminPlayerRow {
  return {
    id: u.id,
    telegramId: u.telegramId.toString(),
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || '—',
    username: u.username,
    balance: toCoins(u.balance),
    totalEarned: toCoins(u.totalEarned),
    profitPerHour: Number(u.profitPerHour),
    leagueLevel: u.leagueLevel,
    suspiciousScore: u.suspiciousScore,
    isBanned: u.isBanned,
    createdAt: u.createdAt.getTime(),
    lastSeenAt: u.lastSeenAt.getTime(),
  };
}

async function details(id: number, before?: string): Promise<AdminPlayerDetails> {
  const u = await prisma.user.findUnique({ where: { id }, include: { referrer: true } });
  if (!u) throw new ApiError('NOT_FOUND', 'Player not found');
  const [friends, achievements, txs] = await Promise.all([
    prisma.referral.count({ where: { inviterId: id } }),
    prisma.userAchievement.count({ where: { userId: id } }),
    prisma.transaction.findMany({
      where: { userId: id, ...(before ? { id: { lt: BigInt(before) } } : {}) },
      orderBy: { id: 'desc' },
      take: TX_PAGE + 1,
    }),
  ]);
  const page = txs.slice(0, TX_PAGE);
  const transactions: AdminTransaction[] = page.map((t) => ({
    id: t.id.toString(),
    type: t.type,
    amount: t.amount.toNumber(),
    balanceAfter: toCoins(t.balanceAfter),
    count: t.count,
    meta: t.meta,
    createdAt: t.createdAt.getTime(),
  }));
  return {
    ...row(u),
    lastName: u.lastName,
    languageCode: u.languageCode,
    isPremium: u.isPremium,
    banReason: u.banReason,
    totalTaps: Number(u.totalTaps),
    multitapLevel: u.multitapLevel,
    energyLimitLevel: u.energyLimitLevel,
    friends,
    referrer: u.referrer ? { id: u.referrer.id, name: u.referrer.firstName || '—' } : null,
    walletAddress: u.walletAddress ? friendlyAddress(u.walletAddress) : null,
    achievements,
    hqId: u.hqId,
    transactions,
    nextBefore: txs.length > TX_PAGE ? page[page.length - 1]!.id.toString() : null,
  };
}

/** Игроки в админке: поиск, карточка с журналом, бан/разбан, ручное начисление, подозрительные. */
export async function adminPlayerRoutes(app: FastifyInstance): Promise<void> {
  /** Поиск: числом — по id и Telegram ID, текстом — по username и имени. */
  app.get('/api/admin/players', async (request): Promise<{ players: AdminPlayerRow[] }> => {
    await requireAdmin(request);
    const { q } = SearchQuery.parse(request.query);
    const text = q.replace(/^@/, '');
    let where: Prisma.UserWhereInput = {};
    if (/^\d{1,20}$/.test(text)) {
      const n = BigInt(text);
      where = { OR: [{ telegramId: n }, ...(n <= 2_147_483_647n ? [{ id: Number(n) }] : [])] };
    } else if (text) {
      where = {
        OR: [
          { username: { contains: text, mode: 'insensitive' } },
          { firstName: { contains: text, mode: 'insensitive' } },
          { lastName: { contains: text, mode: 'insensitive' } },
        ],
      };
    }
    const users = await prisma.user.findMany({ where, orderBy: { totalEarned: 'desc' }, take: 30 });
    return { players: users.map(row) };
  });

  app.get('/api/admin/suspicious', async (request): Promise<{ players: AdminPlayerRow[] }> => {
    await requireAdmin(request);
    const users = await prisma.user.findMany({
      where: { suspiciousScore: { gte: SUSPICIOUS_THRESHOLD } },
      orderBy: [{ isBanned: 'asc' }, { suspiciousScore: 'desc' }],
      take: 100,
    });
    return { players: users.map(row) };
  });

  app.get('/api/admin/players/:id', async (request): Promise<AdminPlayerDetails> => {
    await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const { before } = TxQuery.parse(request.query);
    return details(id, before);
  });

  app.post('/api/admin/players/:id/ban', async (request): Promise<AdminPlayerDetails> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const { reason } = BanBody.parse(request.body);
    if (id === admin.id) throw new ApiError('VALIDATION', 'You cannot ban yourself');
    const updated = await prisma.user.updateMany({
      where: { id },
      data: { isBanned: true, banReason: reason },
    });
    if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Player not found');
    clearLeaderboardCache();
    request.log.warn({ admin: admin.telegramId.toString(), playerId: id, reason }, 'admin: player banned');
    return details(id);
  });

  /** Разбан: подозрительность обнуляется — игрок проверен. */
  app.post('/api/admin/players/:id/unban', async (request): Promise<AdminPlayerDetails> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const updated = await prisma.user.updateMany({
      where: { id },
      data: { isBanned: false, banReason: null, suspiciousScore: 0 },
    });
    if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Player not found');
    clearLeaderboardCache();
    request.log.warn({ admin: admin.telegramId.toString(), playerId: id }, 'admin: player unbanned');
    return details(id);
  });

  app.post('/api/admin/players/:id/clear-suspicion', async (request): Promise<AdminPlayerDetails> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const updated = await prisma.user.updateMany({ where: { id }, data: { suspiciousScore: 0 } });
    if (updated.count === 0) throw new ApiError('NOT_FOUND', 'Player not found');
    request.log.warn({ admin: admin.telegramId.toString(), playerId: id }, 'admin: suspicion cleared');
    return details(id);
  });

  /** Ручное начисление или списание — через общий журнал, с админом и причиной в meta. */
  app.post('/api/admin/players/:id/credit', async (request): Promise<AdminPlayerDetails> => {
    const admin = await requireAdmin(request);
    const { id } = Params.parse(request.params);
    const { amount, reason } = CreditBody.parse(request.body);
    if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) {
      throw new ApiError('NOT_FOUND', 'Player not found');
    }
    await withUserLock(
      id,
      (tx, user) =>
        applyBalanceChanges(
          tx,
          user,
          [{ type: 'admin_adjustment', amount, meta: { admin: admin.telegramId.toString(), reason } }],
          {},
          new Date(),
        ),
      { allowBanned: true },
    );
    clearLeaderboardCache();
    request.log.warn(
      { admin: admin.telegramId.toString(), playerId: id, amount, reason },
      'admin: balance adjusted',
    );
    return details(id);
  });
}
