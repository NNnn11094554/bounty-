import type {
  AuthResponse,
  CollectionActionResponse,
  CollectionResponse,
  InvoiceResponse,
  ShopResponse,
  StateResponse,
} from '@meowgul/shared';
import { COSMETICS, DEFAULT_SKIN_ID, LEGACY_SKINS, levelThreshold, playerLevel } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('level formula: long progression — level 2 at 20k, 40 at 450B, 50 at 6T', () => {
    expect(playerLevel(0).level).toBe(1);
    expect(playerLevel(levelThreshold(3)).level).toBe(3);
    expect(playerLevel(levelThreshold(3) - 1).level).toBe(2);
    expect(levelThreshold(2)).toBe(20_000);
    expect(levelThreshold(40)).toBe(450_000_000_000);
    expect(levelThreshold(50)).toBe(6_000_000_000_000);
    for (let l = 2; l < 50; l++) expect(levelThreshold(l + 1)).toBeGreaterThan(levelThreshold(l));
    expect(playerLevel(1e15).level).toBe(50);
  });

  it('a new player owns and wears the starting cat and coin effect', async () => {
    const c = await player(17001);
    expect((await c.get('/api/collection')).json<CollectionResponse>()).toEqual({
      owned: ['neon_punk', 'coins'],
      equipped: { skin: 'neon_punk', effect: 'coins' },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.cosmetics).toEqual({ skin: 'neon_punk', effect: 'coins' });
  });

  it('level skins: locked below the level, bought for coins once, equipped and kept after reload', async () => {
    const low = await player(17002, 1_000, 50_000);
    const locked = await low.post('/api/collection/desert_nomad/buy');
    expect(locked.statusCode).toBe(409);
    expect(code(locked)).toBe('LOCKED');
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 17002n } })).balance.toNumber()).toBe(
      50_000,
    );

    const c = await player(17003, levelThreshold(3), 50_000);
    const res = await c.post('/api/collection/desert_nomad/buy');
    expect(res.statusCode).toBe(200);
    const body = res.json<CollectionActionResponse>();
    expect(body.owned).toContain('desert_nomad');
    expect(body.equipped.skin).toBe('desert_nomad');
    expect(body.state.cosmetics.skin).toBe('desert_nomad');
    expect(body.state.balance).toBe(40_000);
    expect(await prisma.transaction.count({ where: { type: 'cosmetic_purchase' } })).toBe(1);

    const again = await c.post('/api/collection/desert_nomad/buy');
    expect(code(again)).toBe('CONFLICT');

    // переодеться в стартового и обратно; после «перезагрузки» надетый скин на месте
    await c.post('/api/collection/neon_punk/equip');
    await c.post('/api/collection/desert_nomad/equip');
    const reloaded = (await c.post('/api/auth')).json<AuthResponse>();
    expect(reloaded.state.cosmetics.skin).toBe('desert_nomad');
  });

  it('cannot equip what is not owned, buy Stars items for coins or unknown items', async () => {
    const c = await player(17004, levelThreshold(30), 10_000_000_000);
    expect(code(await c.post('/api/collection/dark_reaper/equip'))).toBe('LOCKED');
    expect(code(await c.post('/api/collection/angel_guardian/buy'))).toBe('VALIDATION');
    expect((await c.post('/api/collection/free_cat/buy')).statusCode).toBe(404);
    const poor = await player(17005, levelThreshold(5), 100);
    expect(code(await poor.post('/api/collection/sakura_blossom/buy'))).toBe('INSUFFICIENT_FUNDS');
    expect((await poor.get('/api/collection')).json<CollectionResponse>().owned).not.toContain(
      'sakura_blossom',
    );
  });

  it('effects are equipped separately from skins', async () => {
    const c = await player(17006, levelThreshold(6), 1_000_000);
    await c.post('/api/collection/hearts/buy');
    const res = (await c.post('/api/collection/stars/buy')).json<CollectionActionResponse>();
    expect(res.equipped).toEqual({ skin: 'neon_punk', effect: 'stars' });
    const back = (await c.post('/api/collection/hearts/equip')).json<CollectionActionResponse>();
    expect(back.state.cosmetics).toEqual({ skin: 'neon_punk', effect: 'hearts' });
  });

  it('premium skins: Stars invoice → delivered and equipped, no second invoice, refund takes it back', async () => {
    setPaymentsGateway({
      createInvoiceLink: (inv) => Promise.resolve(`https://t.me/$${inv.payload}`),
      refund: () => Promise.resolve(),
    });
    const c = await player(17007);
    const shop = (await c.get('/api/shop')).json<ShopResponse>().products;
    expect(shop.find((p) => p.id === 'skin_angel_guardian')).toMatchObject({
      kind: 'cosmetic',
      stars: 149,
      owned: false,
    });

    const inv = (
      await c.post('/api/shop/invoice', { productId: 'skin_angel_guardian' })
    ).json<InvoiceResponse>();
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: inv.purchaseId } });
    expect(
      await fulfillPayment({
        payload: purchase.payload,
        fromId: 17007,
        currency: 'XTR',
        totalAmount: 149,
        chargeId: 'ch-angel',
      }),
    ).toBe('paid');
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned).toContain('angel_guardian');
    expect(col.equipped.skin).toBe('angel_guardian');
    expect(
      (await c.get('/api/shop')).json<ShopResponse>().products.find((p) => p.id === 'skin_angel_guardian')!
        .owned,
    ).toBe(true);
    expect(code(await c.post('/api/shop/invoice', { productId: 'skin_angel_guardian' }))).toBe('CONFLICT');

    await refundPurchase(purchase.id);
    const after = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(after.owned).not.toContain('angel_guardian');
    expect(after.equipped.skin).toBe('neon_punk');
  });
  it('catalog: 20 distinct characters, one free starter, rarities are cosmetic only', () => {
    const skins = COSMETICS.filter((c) => c.kind === 'skin');
    expect(skins).toHaveLength(20);
    expect(new Set(skins.map((s) => s.id)).size).toBe(20);
    expect(skins.filter((s) => s.price === null).map((s) => s.id)).toEqual([DEFAULT_SKIN_ID]);
    for (const s of skins) {
      expect(['EPIC', 'LEGENDARY', 'MYTHIC']).toContain(s.rarity);
      expect(s.name.ru && s.name.en && s.desc.ru && s.desc.en).toBeTruthy();
      // в каталоге нет ничего, кроме внешнего вида: ни дохода, ни множителей
      expect(Object.keys(s).sort()).toEqual(['desc', 'id', 'kind', 'name', 'price', 'rarity', 'unlockLevel']);
    }
    // ни одного скина прошлой коллекции
    for (const old of Object.keys(LEGACY_SKINS)) expect(skins.some((s) => s.id === old)).toBe(false);
    for (const next of Object.values(LEGACY_SKINS)) expect(skins.some((s) => s.id === next)).toBe(true);
  });

  it('migration: old skins become their new equivalents, equipped old skin → new default, progress kept', async () => {
    await player(17010, 123_456, 7_890);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17010n } });
    // состояние «до миграции»: старые скины куплены, старый надет
    await prisma.userCosmetic.createMany({
      data: [
        { userId: user.id, cosmeticId: 'queen', source: 'stars' },
        { userId: user.id, cosmeticId: 'pink_angel', source: 'coins' },
        { userId: user.id, cosmeticId: 'hearts', source: 'coins' },
      ],
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { equippedSkinId: 'queen', equippedEffectId: 'hearts' },
    });
    await player(17011);
    await prisma.user.update({ where: { telegramId: 17011n }, data: { equippedSkinId: 'black_crown' } });

    const sql = readFileSync(
      new URL('../prisma/migrations/20261005120000_skin_characters/migration.sql', import.meta.url),
      'utf8',
    );
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.replace(/^--.*$/gm, '').trim())
      .filter(Boolean);
    await prisma.$transaction(async (tx) => {
      for (const st of statements) await tx.$executeRawUnsafe(st);
    });

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { cosmetics: true },
    });
    expect(after.equippedSkinId).toBe(DEFAULT_SKIN_ID);
    expect(after.equippedEffectId).toBe('hearts');
    expect(after.balance.toNumber()).toBe(7_890);
    expect(after.totalEarned.toNumber()).toBe(123_456);
    expect(after.cosmetics.map((c) => [c.cosmeticId, c.source]).sort()).toEqual([
      ['desert_nomad', 'coins'],
      ['hearts', 'coins'],
      ['shadow_drifter', 'stars'],
    ]);
    const other = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17011n } });
    expect(other.equippedSkinId).toBe(DEFAULT_SKIN_ID);
  });

  it('an unknown equipped skin is shown as the default, a legacy Stars invoice delivers the new character', async () => {
    const c = await player(17012);
    await prisma.user.update({ where: { telegramId: 17012n }, data: { equippedSkinId: 'golden_boss' } });
    expect((await c.get('/api/state')).json<StateResponse>().state.cosmetics.skin).toBe(DEFAULT_SKIN_ID);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17012n } });
    const purchase = await prisma.purchase.create({
      data: {
        userId: user.id,
        productId: 'skin_queen',
        stars: 249,
        payload: 'legacy-queen',
        grant: { cosmetic: 'queen' },
      },
    });
    expect(
      await fulfillPayment({
        payload: purchase.payload,
        fromId: 17012,
        currency: 'XTR',
        totalAmount: 249,
        chargeId: 'ch-legacy',
      }),
    ).toBe('paid');
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned).toContain('shadow_drifter');
    expect(col.equipped.skin).toBe('shadow_drifter');
    setPaymentsGateway({ createInvoiceLink: () => Promise.resolve(''), refund: () => Promise.resolve() });
    await refundPurchase(purchase.id);
    const back = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(back.owned).not.toContain('shadow_drifter');
    expect(back.equipped.skin).toBe(DEFAULT_SKIN_ID);
  });

  it('equip validation: unknown id → 404, too long id → 400, rapid switching ends on the last request', async () => {
    const c = await player(17013, levelThreshold(5), 1_000_000);
    expect((await c.post('/api/collection/hamster_king/equip')).statusCode).toBe(404);
    expect((await c.post(`/api/collection/${'x'.repeat(41)}/equip`)).statusCode).toBe(400);
    await c.post('/api/collection/desert_nomad/buy');
    await c.post('/api/collection/sakura_blossom/buy');
    const order = [
      'neon_punk',
      'desert_nomad',
      'sakura_blossom',
      'neon_punk',
      'desert_nomad',
      'sakura_blossom',
    ];
    for (const id of order) expect((await c.post(`/api/collection/${id}/equip`)).statusCode).toBe(200);
    expect((await c.get('/api/state')).json<StateResponse>().state.cosmetics.skin).toBe('sakura_blossom');
  });
});
