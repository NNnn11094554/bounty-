import type { AuthResponse, FriendsResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REFERRAL } from '../src/game/config/rewards.js';
import { prisma } from '../src/lib/db.js';
import { applyBalanceChanges } from '../src/services/ledger.js';
import { leagueBonus, parseReferral, referralLink } from '../src/services/referrals.js';
import { withUserLock } from '../src/services/userLock.js';
import { authHeader, client, createApp, resetDb, tgUser } from './helpers.js';

describe('referrals', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
  });

  async function login(id: number, opts: { ref?: string; premium?: boolean } = {}): Promise<AuthResponse> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth',
      headers: authHeader(tgUser(id, { is_premium: opts.premium }), { startParam: opts.ref }),
    });
    expect(res.statusCode).toBe(200);
    return res.json<AuthResponse>();
  }

  const balance = async (id: number) =>
    (await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(id) } })).balance.toNumber();

  it('parses start_param and builds links', () => {
    expect(parseReferral('ref_123456')).toBe(123456n);
    expect(parseReferral('ref_')).toBeNull();
    expect(parseReferral('ref_12a')).toBeNull();
    expect(parseReferral('promo')).toBeNull();
    expect(parseReferral(null)).toBeNull();
    expect(referralLink(42n)).toMatch(/^https:\/\/t\.me\/[\w]+\/[\w]+\?startapp=ref_42$/);
    expect(leagueBonus([1, 2], false)).toBe(50_000);
    expect(leagueBonus([1], true)).toBe(40_000);
  });

  it('a new friend gives +5 000 to both and Silver league bonus to the inviter', async () => {
    await login(11001);
    const res = await login(11002, { ref: 'ref_11001' });
    expect(res.isNew).toBe(true);
    expect(res.referral).toEqual({ inviterName: 'Cat11001', bonus: 5_000 });
    expect(res.state.balance).toBe(5_000);
    // 5 000 заработанных — это уже лига Silver: пригласивший получает и бонус за лигу
    expect(res.state.leagueLevel).toBe(1);
    expect(await balance(11001)).toBe(5_000 + REFERRAL.leagues[1]!);

    const ref = await prisma.referral.findFirstOrThrow();
    expect(ref).toMatchObject({ isPremium: false, leagueBonusesGiven: [1] });
    expect(Number(ref.inviterEarned)).toBe(25_000);
    const invitee = await prisma.user.findUniqueOrThrow({ where: { telegramId: 11002n } });
    expect(invitee.referrerId).toBe(ref.inviterId);
  });

  it('a Premium friend gives +25 000 to both and doubled league bonuses', async () => {
    await login(11011);
    const res = await login(11012, { ref: 'ref_11011', premium: true });
    expect(res.referral?.bonus).toBe(25_000);
    expect(res.state.leagueLevel).toBe(2);
    const expected = 25_000 + 2 * (REFERRAL.leagues[1]! + REFERRAL.leagues[2]!);
    expect(await balance(11011)).toBe(expected);
  });

  it('league bonuses are paid once per league as the friend grows', async () => {
    await login(11021);
    await login(11022, { ref: 'ref_11021' });
    const inviter = await prisma.user.findUniqueOrThrow({ where: { telegramId: 11021n } });
    const friend = await prisma.user.findUniqueOrThrow({ where: { telegramId: 11022n } });
    const before = inviter.balance.toNumber();
    // друг заработал до Platinum (Gold и Platinum — сразу два бонуса)
    await withUserLock(friend.id, (tx, u) =>
      applyBalanceChanges(tx, u, [{ type: 'admin_adjustment', amount: 100_000 }]),
    );
    const after = (await prisma.user.findUniqueOrThrow({ where: { id: inviter.id } })).balance.toNumber();
    expect(after - before).toBe(REFERRAL.leagues[2]! + REFERRAL.leagues[3]!);
    // траты и новые заработки внутри той же лиги бонусов не дают
    await withUserLock(friend.id, (tx, u) =>
      applyBalanceChanges(tx, u, [{ type: 'admin_adjustment', amount: 1_000 }]),
    );
    const again = (await prisma.user.findUniqueOrThrow({ where: { id: inviter.id } })).balance.toNumber();
    expect(again).toBe(after);
    const txs = await prisma.transaction.findMany({
      where: { userId: inviter.id, type: 'referral_league_bonus' },
    });
    expect(txs).toHaveLength(2);
  });

  it('ignores self-invites, existing players, unknown and banned inviters', async () => {
    const self = await login(11031, { ref: 'ref_11031' });
    expect(self.referral).toBeNull();

    await login(11032);
    const existing = await login(11033);
    expect(existing.isNew).toBe(true);
    const again = await login(11033, { ref: 'ref_11032' });
    expect(again.isNew).toBe(false);
    expect(again.referral).toBeNull();

    expect((await login(11034, { ref: 'ref_999999999' })).referral).toBeNull();

    await login(11035);
    await prisma.user.update({ where: { telegramId: 11035n }, data: { isBanned: true } });
    expect((await login(11036, { ref: 'ref_11035' })).referral).toBeNull();
    expect(await prisma.referral.count()).toBe(0);
  });

  it('parallel first logins with a referral count once', async () => {
    await login(11041);
    const header = authHeader(tgUser(11042), { startParam: 'ref_11041' });
    await Promise.all([1, 2, 3].map(() => app.inject({ method: 'POST', url: '/api/auth', headers: header })));
    expect(await prisma.referral.count()).toBe(1);
    expect(await balance(11042)).toBe(5_000);
  });

  it('GET /api/friends lists friends with my bonus, paginated', async () => {
    await login(11051);
    for (let i = 0; i < 3; i++) await login(11060 + i, { ref: 'ref_11051', premium: i === 0 });
    const c = client(app, tgUser(11051));
    const res = (await c.get('/api/friends')).json<FriendsResponse>();
    expect(res.total).toBe(3);
    expect(res.link).toContain('startapp=ref_11051');
    expect(res.friends.map((f) => f.name)).toEqual(['Cat11062', 'Cat11061', 'Cat11060']);
    expect(res.friends[2]).toMatchObject({ isPremium: true, leagueLevel: 2 });
    expect(res.friends[2]!.bonus).toBe(25_000 + 2 * (REFERRAL.leagues[1]! + REFERRAL.leagues[2]!));
    expect(res.earned).toBe(res.friends.reduce((s, f) => s + f.bonus, 0));
    expect(res.nextCursor).toBeNull();
    expect(res.bonuses.leagues[0]).toEqual({ level: 1, regular: 20_000, premium: 40_000 });

    const empty = (await c.get(`/api/friends?after=${res.friends[2]!.id}`)).json<FriendsResponse>();
    expect(empty.friends).toEqual([]);
  });

  it('pages friends 50 at a time', async () => {
    await login(11070);
    const inviter = await prisma.user.findUniqueOrThrow({ where: { telegramId: 11070n } });
    await prisma.user.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({ telegramId: BigInt(12_000 + i), firstName: `F${i}` })),
    });
    const friends = await prisma.user.findMany({
      where: { telegramId: { gte: 12_000n } },
      orderBy: { id: 'asc' },
    });
    await prisma.referral.createMany({
      data: friends.map((f) => ({ inviterId: inviter.id, inviteeId: f.id })),
    });
    const c = client(app, tgUser(11070));
    const first = (await c.get('/api/friends')).json<FriendsResponse>();
    expect(first.total).toBe(55);
    expect(first.friends).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = (await c.get(`/api/friends?after=${first.nextCursor}`)).json<FriendsResponse>();
    expect(second.friends).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const ids = new Set([...first.friends, ...second.friends].map((f) => f.id));
    expect(ids.size).toBe(55);
  });
});
