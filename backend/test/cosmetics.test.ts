import type {
  AuthResponse,
  CollectionActionResponse,
  CollectionResponse,
  InvoiceResponse,
  ShopResponse,
  StateResponse,
} from '@meowgul/shared';
import {
  COSMETICS,
  DEFAULT_SKIN_ID,
  isFreeCosmetic,
  leagueRewardSkins,
  LEGACY_SKINS,
  levelThreshold,
  playerLevel,
} from '@meowgul/shared';
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

  async function player(id: number, earned = 0, balance = 0, leagueLevel = 9) {
    const c = client(app, tgUser(id));
    (await c.post('/api/auth')).json<AuthResponse>();
    if (earned || balance) {
      await prisma.user.update({
        where: { telegramId: BigInt(id) },
        data: { totalEarned: earned, balance, leagueLevel },
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

  it('a new player owns the 3 free cats and the coin effect, wears the starting cat', async () => {
    const c = await player(17001);
    expect((await c.get('/api/collection')).json<CollectionResponse>()).toEqual({
      owned: ['neon_punk', 'desert_nomad', 'sakura_blossom', 'coins'],
      equipped: { skin: 'neon_punk', effect: 'coins' },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.cosmetics).toEqual({ skin: 'neon_punk', effect: 'coins' });
  });

  it('free skins: equipped without buying, not sold for coins, kept after reload', async () => {
    const c = await player(17003, 1_000, 50_000, 0);
    const res = await c.post('/api/collection/desert_nomad/equip');
    expect(res.statusCode).toBe(200);
    const body = res.json<CollectionActionResponse>();
    expect(body.equipped.skin).toBe('desert_nomad');
    expect(body.state.cosmetics.skin).toBe('desert_nomad');
    expect(code(await c.post('/api/collection/sakura_blossom/buy'))).toBe('VALIDATION');
    expect(await prisma.transaction.count({ where: { type: 'cosmetic_purchase' } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 17003n } })).balance.toNumber()).toBe(
      50_000,
    );
    // переодеться и обратно; после «перезагрузки» надетый скин на месте
    await c.post('/api/collection/sakura_blossom/equip');
    await c.post('/api/collection/desert_nomad/equip');
    const reloaded = (await c.post('/api/auth')).json<AuthResponse>();
    expect(reloaded.state.cosmetics.skin).toBe('desert_nomad');
  });

  it('league skins: closed below the league, then owned for free (Silver, Gold, Platinum), not sold', async () => {
    const bronze = await player(17002, 1_000, 50_000, 0);
    expect((await bronze.get('/api/collection')).json<CollectionResponse>().owned).not.toContain('astro_cat');
    expect(code(await bronze.post('/api/collection/astro_cat/equip'))).toBe('LOCKED');
    expect(code(await bronze.post('/api/collection/astro_cat/buy'))).toBe('VALIDATION');

    const gold = await player(17008, 1_000_000, 0, 2);
    const owned = (await gold.get('/api/collection')).json<CollectionResponse>().owned;
    expect(owned).toEqual(expect.arrayContaining(['astro_cat', 'mecha']));
    expect(owned).not.toContain('crystal_prince');
    expect(code(await gold.post('/api/collection/crystal_prince/equip'))).toBe('LOCKED');
    const res = (await gold.post('/api/collection/mecha/equip')).json<CollectionActionResponse>();
    expect(res.state.cosmetics.skin).toBe('mecha');
    // в базе ничего не выдаётся: владение — по лиге
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17008n } });
    expect(await prisma.userCosmetic.count({ where: { userId: user.id } })).toBe(0);

    // поднялся до Platinum — третий скин лиги уже его
    await prisma.user.update({ where: { id: user.id }, data: { leagueLevel: 3 } });
    expect((await gold.post('/api/collection/crystal_prince/equip')).statusCode).toBe(200);
    expect(leagueRewardSkins(1).map((s) => s.id)).toEqual(['astro_cat']);
    expect(leagueRewardSkins(4)).toEqual([]);
  });

  it('cannot equip what is not owned, buy Stars items for coins or unknown items', async () => {
    const c = await player(17004, levelThreshold(30), 10_000_000_000);
    expect(code(await c.post('/api/collection/dark_reaper/equip'))).toBe('LOCKED');
    expect(code(await c.post('/api/collection/angel_guardian/buy'))).toBe('VALIDATION');
    expect((await c.post('/api/collection/free_cat/buy')).statusCode).toBe(404);
    // скин за Stars не продаётся за монеты даже очень богатому игроку
    expect(code(await c.post('/api/collection/royal_emperor/buy'))).toBe('VALIDATION');
    const poor = await player(17005, levelThreshold(6), 100);
    expect(code(await poor.post('/api/collection/stars/buy'))).toBe('INSUFFICIENT_FUNDS');
    expect((await poor.get('/api/collection')).json<CollectionResponse>().owned).not.toContain('stars');
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
    // все 14 скинов за Stars — в магазине, по цене из каталога
    const starSkins = COSMETICS.filter((s) => s.kind === 'skin' && s.price?.currency === 'stars');
    expect(starSkins).toHaveLength(14);
    for (const s of starSkins) {
      expect(shop.find((p) => p.id === `skin_${s.id}`)).toMatchObject({
        kind: 'cosmetic',
        stars: s.price!.amount,
        cosmeticId: s.id,
      });
    }

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
  it('catalog: 20 characters — 3 free, 3 for leagues, 14 for Stars; rarities are cosmetic only', () => {
    const skins = COSMETICS.filter((c) => c.kind === 'skin');
    expect(skins).toHaveLength(20);
    expect(new Set(skins.map((s) => s.id)).size).toBe(20);
    expect(skins.filter((s) => isFreeCosmetic(s)).map((s) => s.id)).toEqual([
      DEFAULT_SKIN_ID,
      'desert_nomad',
      'sakura_blossom',
    ]);
    expect(skins.filter((s) => s.unlockLeague !== undefined).map((s) => [s.id, s.unlockLeague])).toEqual([
      ['astro_cat', 1],
      ['mecha', 2],
      ['crystal_prince', 3],
    ]);
    // скинов за монеты больше нет; за Stars и награды — без условия по уровню
    expect(skins.filter((s) => s.price?.currency === 'coins')).toEqual([]);
    expect(skins.every((s) => s.unlockLevel === 1)).toBe(true);
    for (const s of skins) {
      expect(['EPIC', 'LEGENDARY', 'MYTHIC']).toContain(s.rarity);
      expect(s.name.ru && s.name.en && s.desc.ru && s.desc.en).toBeTruthy();
      // в каталоге нет ничего, кроме внешнего вида и способа получить: ни дохода, ни множителей
      for (const key of Object.keys(s)) {
        expect(['desc', 'id', 'kind', 'name', 'price', 'rarity', 'unlockLevel', 'unlockLeague']).toContain(
          key,
        );
      }
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
