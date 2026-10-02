import type {
  AuthResponse,
  CollectionActionResponse,
  CollectionResponse,
  InvoiceResponse,
  ShopResponse,
  StateResponse,
} from '@meowgul/shared';
import { levelThreshold, playerLevel } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db.js';
import { setPaymentsGateway } from '../src/services/payments.js';
import { fulfillPayment, refundPurchase } from '../src/services/shop.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

describe('collection: skins and tap effects', () => {
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
  afterEach(() => setPaymentsGateway(null));

  async function player(id: number, earned = 0, balance = 0) {
    const c = client(app, tgUser(id));
    (await c.post('/api/auth')).json<AuthResponse>();
    if (earned || balance) {
      await prisma.user.update({
        where: { telegramId: BigInt(id) },
        data: { totalEarned: earned, balance, leagueLevel: 9 },
      });
    }
    return c;
  }
  const code = (res: { json: () => unknown }) => (res.json() as { error: { code: string } }).error.code;

  it('level formula: thresholds grow, level 3 ≈ 23k, 30 ≈ 120M', () => {
    expect(playerLevel(0).level).toBe(1);
    expect(playerLevel(levelThreshold(3)).level).toBe(3);
    expect(playerLevel(levelThreshold(3) - 1).level).toBe(2);
    expect(levelThreshold(3)).toBe(23_000);
    expect(levelThreshold(30)).toBeGreaterThan(100_000_000);
    expect(playerLevel(1e15).level).toBe(50);
  });

  it('a new player owns and wears the starting cat and coin effect', async () => {
    const c = await player(17001);
    expect((await c.get('/api/collection')).json<CollectionResponse>()).toEqual({
      owned: ['black_crown', 'coins'],
      equipped: { skin: 'black_crown', effect: 'coins' },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.cosmetics).toEqual({ skin: 'black_crown', effect: 'coins' });
  });

  it('level skins: locked below the level, bought for coins once, equipped and kept after reload', async () => {
    const low = await player(17002, 1_000, 50_000);
    const locked = await low.post('/api/collection/pink_angel/buy');
    expect(locked.statusCode).toBe(409);
    expect(code(locked)).toBe('LOCKED');
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 17002n } })).balance.toNumber()).toBe(
      50_000,
    );

    const c = await player(17003, levelThreshold(3), 50_000);
    const res = await c.post('/api/collection/pink_angel/buy');
    expect(res.statusCode).toBe(200);
    const body = res.json<CollectionActionResponse>();
    expect(body.owned).toContain('pink_angel');
    expect(body.equipped.skin).toBe('pink_angel');
    expect(body.state.cosmetics.skin).toBe('pink_angel');
    expect(body.state.balance).toBe(40_000);
    expect(await prisma.transaction.count({ where: { type: 'cosmetic_purchase' } })).toBe(1);

    const again = await c.post('/api/collection/pink_angel/buy');
    expect(code(again)).toBe('CONFLICT');

    // переодеться в стартового и обратно; после «перезагрузки» надетый скин на месте
    await c.post('/api/collection/black_crown/equip');
    await c.post('/api/collection/pink_angel/equip');
    const reloaded = (await c.post('/api/auth')).json<AuthResponse>();
    expect(reloaded.state.cosmetics.skin).toBe('pink_angel');
  });

  it('cannot equip what is not owned, buy Stars items for coins or unknown items', async () => {
    const c = await player(17004, levelThreshold(30), 10_000_000_000);
    expect(code(await c.post('/api/collection/hacker/equip'))).toBe('LOCKED');
    expect(code(await c.post('/api/collection/diamond/buy'))).toBe('VALIDATION');
    expect((await c.post('/api/collection/free_cat/buy')).statusCode).toBe(404);
    const poor = await player(17005, levelThreshold(5), 100);
    expect(code(await poor.post('/api/collection/cyber/buy'))).toBe('INSUFFICIENT_FUNDS');
    expect((await poor.get('/api/collection')).json<CollectionResponse>().owned).not.toContain('cyber');
  });

  it('effects are equipped separately from skins', async () => {
    const c = await player(17006, levelThreshold(6), 1_000_000);
    await c.post('/api/collection/hearts/buy');
    const res = (await c.post('/api/collection/stars/buy')).json<CollectionActionResponse>();
    expect(res.equipped).toEqual({ skin: 'black_crown', effect: 'stars' });
    const back = (await c.post('/api/collection/hearts/equip')).json<CollectionActionResponse>();
    expect(back.state.cosmetics).toEqual({ skin: 'black_crown', effect: 'hearts' });
  });

  it('premium skins: Stars invoice → delivered and equipped, no second invoice, refund takes it back', async () => {
    setPaymentsGateway({
      createInvoiceLink: (inv) => Promise.resolve(`https://t.me/$${inv.payload}`),
      refund: () => Promise.resolve(),
    });
    const c = await player(17007);
    const shop = (await c.get('/api/shop')).json<ShopResponse>().products;
    expect(shop.find((p) => p.id === 'skin_diamond')).toMatchObject({
      kind: 'cosmetic',
      stars: 149,
      owned: false,
    });

    const inv = (await c.post('/api/shop/invoice', { productId: 'skin_diamond' })).json<InvoiceResponse>();
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: inv.purchaseId } });
    expect(
      await fulfillPayment({
        payload: purchase.payload,
        fromId: 17007,
        currency: 'XTR',
        totalAmount: 149,
        chargeId: 'ch-diamond',
      }),
    ).toBe('paid');
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned).toContain('diamond');
    expect(col.equipped.skin).toBe('diamond');
    expect(
      (await c.get('/api/shop')).json<ShopResponse>().products.find((p) => p.id === 'skin_diamond')!.owned,
    ).toBe(true);
    expect(code(await c.post('/api/shop/invoice', { productId: 'skin_diamond' }))).toBe('CONFLICT');

    await refundPurchase(purchase.id);
    const after = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(after.owned).not.toContain('diamond');
    expect(after.equipped.skin).toBe('black_crown');
  });
});
