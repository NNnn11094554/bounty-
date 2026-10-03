import type {
  ApiErrorBody,
  CardUpgradeResponse,
  CardsResponse,
  CollectionActionResponse,
  CollectionResponse,
  StateResponse,
} from '@meowgul/shared';
import { COSMETICS } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env, resolveDeveloperId } from '../src/env.js';
import { CARDS } from '../src/game/config/cards.js';
import { prisma } from '../src/lib/db.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

// ADMIN_TELEGRAM_IDS из test/setup.ts — админ один, DEVELOPER_TELEGRAM_ID не задан → режим у него
const ADMIN_ID = 999000999;

describe('developer mode (one account only)', () => {
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

  async function login(id: number, balance = 0) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    await prisma.user.update({ where: { telegramId: BigInt(id) }, data: { balance } });
    return c;
  }
  const code = (res: { json: () => unknown }) => (res.json() as ApiErrorBody).error.code;

  it('belongs to exactly one account: DEVELOPER_TELEGRAM_ID, else the only admin, else nobody', () => {
    expect(resolveDeveloperId('42', new Set([1n, 2n]))).toBe(42n);
    expect(resolveDeveloperId(undefined, new Set([7n]))).toBe(7n);
    expect(resolveDeveloperId(undefined, new Set([7n, 8n]))).toBeNull();
    expect(resolveDeveloperId(undefined, new Set())).toBeNull();
    expect(env.developerId).toBe(BigInt(ADMIN_ID));
  });

  it('another admin (not the owner) cannot use it, and an old flag gives nothing', async () => {
    const c = await login(ADMIN_ID);
    await c.patch('/api/settings', { devMode: true });
    const saved = env.developerId;
    env.developerId = 123n; // владелец режима — другой аккаунт
    try {
      expect((await c.get('/api/state')).json<StateResponse>().state.profile.isDeveloper).toBe(false);
      expect(code(await c.patch('/api/settings', { devMode: true }))).toBe('FORBIDDEN');
      expect((await c.get('/api/collection')).json<CollectionResponse>().owned).toHaveLength(2);
    } finally {
      env.developerId = saved;
    }
    expect((await c.get('/api/state')).json<StateResponse>().state.profile.isDeveloper).toBe(true);
  });

  it('a regular player cannot turn it on', async () => {
    const c = await login(18001);
    const res = await c.patch('/api/settings', { devMode: true });
    expect(res.statusCode).toBe(403);
    expect(code(res)).toBe('FORBIDDEN');
    // и старые флаги в базе без прав админа ничего не дают
    await prisma.user.update({ where: { telegramId: 18001n }, data: { settings: { devMode: true } } });
    expect((await c.get('/api/collection')).json<CollectionResponse>().owned).toHaveLength(2);
    expect(code(await c.post('/api/collection/galaxy_emperor/equip'))).toBe('LOCKED');
  });

  it('admin: all skins and effects are owned and can be equipped, nothing is granted in the database', async () => {
    const c = await login(ADMIN_ID);
    const on = (await c.patch('/api/settings', { devMode: true })).json<StateResponse>();
    expect(on.state.profile.settings.devMode).toBe(true);
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned.sort()).toEqual(COSMETICS.map((x) => x.id).sort());
    const res = (await c.post('/api/collection/galaxy_emperor/equip')).json<CollectionActionResponse>();
    expect(res.state.cosmetics.skin).toBe('galaxy_emperor');
    await c.post('/api/collection/matrix/equip');
    expect(await prisma.userCosmetic.count()).toBe(0);

    // выключил — снова только своё; надетый не свой показывается как стартовый
    await c.patch('/api/settings', { devMode: false });
    const after = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(after.owned).toHaveLength(2);
    expect(code(await c.post('/api/collection/royal_emperor/equip'))).toBe('LOCKED');
  });

  it('admin: every card is open (no conditions, no limited windows, no cooldowns); prices stay', async () => {
    const c = await login(ADMIN_ID, 10_000_000_000);
    await c.patch('/api/settings', { devMode: true });
    const list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.length).toBe(CARDS.length);
    for (const card of list.cards) {
      expect(card.lock).toBeNull();
      expect(card.available).toBe(true);
    }
    // карточка с условием и карточка с откатом — подряд, без ожидания
    expect((await c.post('/api/cards/mk_margin20/upgrade')).statusCode).toBe(200);
    const first = (await c.post('/api/cards/mk_insurance_fund/upgrade')).json<CardUpgradeResponse>();
    expect(first.cards.find((x) => x.id === 'mk_insurance_fund')?.cooldownUntil).toBeNull();
    expect((await c.post('/api/cards/mk_insurance_fund/upgrade')).statusCode).toBe(200);
    // лимитированные — в любое время
    const limited = CARDS.find((x) => x.isLimited)!;
    expect((await c.post(`/api/cards/${limited.id}/upgrade`)).statusCode).toBe(200);
    // покупки списывают монеты как обычно
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: BigInt(ADMIN_ID) } });
    expect(user.balance.toNumber()).toBeLessThan(10_000_000_000);

    // без режима условия снова действуют
    await c.patch('/api/settings', { devMode: false });
    expect(code(await c.post('/api/cards/sp_laser/upgrade'))).toBe('LOCKED');
  });
});
