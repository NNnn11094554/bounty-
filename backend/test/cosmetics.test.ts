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
  SHOP_PRODUCT_IDS,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOP } from '../src/game/config/shop.js';
import { prisma } from '../src/lib/db.js';
import { setPaymentsGateway } from '../src/services/payments.js';
import { checkPreCheckout, fulfillPayment, refundPurchase } from '../src/services/shop.js';
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

  /** персонажи коллекции: сейчас все три бесплатные, стартовый — первый */
  const FREE_SKINS = ['cyber_samurai', 'galaxy_emperor', 'shadow_drifter'];

  it('a new player owns all 3 characters and the coin effect, wears the starting one', async () => {
    const c = await player(17001);
    expect((await c.get('/api/collection')).json<CollectionResponse>()).toEqual({
      owned: [...FREE_SKINS, 'coins'],
      equipped: { skin: 'cyber_samurai', effect: 'coins' },
    });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.cosmetics).toEqual({ skin: 'cyber_samurai', effect: 'coins' });
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17001n } });
    expect(user.equippedSkinId).toBe(DEFAULT_SKIN_ID);
  });

  it('free skins: equipped without buying, not sold for coins, kept after reload', async () => {
    const c = await player(17003, 1_000, 50_000, 0);
    const res = await c.post('/api/collection/galaxy_emperor/equip');
    expect(res.statusCode).toBe(200);
    const body = res.json<CollectionActionResponse>();
    expect(body.equipped.skin).toBe('galaxy_emperor');
    expect(body.state.cosmetics.skin).toBe('galaxy_emperor');
    expect(code(await c.post('/api/collection/shadow_drifter/buy'))).toBe('VALIDATION');
    expect(await prisma.transaction.count({ where: { type: 'cosmetic_purchase' } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: 17003n } })).balance.toNumber()).toBe(
      50_000,
    );
    // переодеться и обратно; после «перезагрузки» надетый скин на месте
    await c.post('/api/collection/shadow_drifter/equip');
    await c.post('/api/collection/galaxy_emperor/equip');
    const reloaded = (await c.post('/api/auth')).json<AuthResponse>();
    expect(reloaded.state.cosmetics.skin).toBe('galaxy_emperor');
  });

  it('every character is free at any league: no league rewards, nothing granted in the database', async () => {
    const bronze = await player(17002, 1_000, 50_000, 0);
    const legend = await player(17008, 1_000_000, 0, 9);
    for (const c of [bronze, legend]) {
      const { owned } = (await c.get('/api/collection')).json<CollectionResponse>();
      expect(owned.filter((id) => FREE_SKINS.includes(id))).toEqual(FREE_SKINS);
      expect((await c.post('/api/collection/shadow_drifter/equip')).statusCode).toBe(200);
    }
    for (let league = 0; league <= 9; league++) expect(leagueRewardSkins(league)).toEqual([]);
    expect(await prisma.userCosmetic.count()).toBe(0);
  });

  it('cannot equip what is not owned, buy Stars items for coins, free or removed items', async () => {
    const c = await player(17004, levelThreshold(30), 10_000_000_000);
    expect(code(await c.post('/api/collection/matrix/equip'))).toBe('LOCKED');
    // эффект за Stars не продаётся за монеты даже очень богатому игроку
    expect(code(await c.post('/api/collection/matrix/buy'))).toBe('VALIDATION');
    expect(code(await c.post('/api/collection/cyber_samurai/buy'))).toBe('VALIDATION');
    expect((await c.post('/api/collection/free_cat/buy')).statusCode).toBe(404);
    // персонажи, убранные из коллекции, — неизвестные предметы
    expect((await c.post('/api/collection/royal_emperor/equip')).statusCode).toBe(404);
    expect((await c.post('/api/collection/angel_guardian/buy')).statusCode).toBe(404);
    const poor = await player(17005, levelThreshold(6), 100);
    expect(code(await poor.post('/api/collection/stars/buy'))).toBe('INSUFFICIENT_FUNDS');
    expect((await poor.get('/api/collection')).json<CollectionResponse>().owned).not.toContain('stars');
  });

  it('effects are equipped separately from skins', async () => {
    const c = await player(17006, levelThreshold(6), 1_000_000);
    await c.post('/api/collection/galaxy_emperor/equip');
    await c.post('/api/collection/hearts/buy');
    const res = (await c.post('/api/collection/stars/buy')).json<CollectionActionResponse>();
    expect(res.equipped).toEqual({ skin: 'galaxy_emperor', effect: 'stars' });
    const back = (await c.post('/api/collection/hearts/equip')).json<CollectionActionResponse>();
    expect(back.state.cosmetics).toEqual({ skin: 'galaxy_emperor', effect: 'hearts' });
  });

  it('Stars shop: no characters for sale; the premium effect → delivered and equipped, refund takes it back', async () => {
    setPaymentsGateway({
      createInvoiceLink: (inv) => Promise.resolve(`https://t.me/$${inv.payload}`),
      refund: () => Promise.resolve(),
    });
    const c = await player(17007);
    const shop = (await c.get('/api/shop')).json<ShopResponse>().products;
    // в магазине — только предметы, которые каталог продаёт за Stars (сейчас это эффект «Матрица»)
    const cosmetics = shop.filter((p) => p.kind === 'cosmetic');
    expect(cosmetics.map((p) => p.id)).toEqual(['effect_matrix']);
    expect(shop.some((p) => p.id.startsWith('skin_'))).toBe(false);
    expect(cosmetics[0]).toMatchObject({ stars: 99, cosmeticId: 'matrix', owned: false });
    expect(code(await c.post('/api/shop/invoice', { productId: 'skin_cyber_samurai' }))).toBe('VALIDATION');

    const inv = (await c.post('/api/shop/invoice', { productId: 'effect_matrix' })).json<InvoiceResponse>();
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: inv.purchaseId } });
    const pay = { payload: purchase.payload, fromId: 17007, currency: 'XTR', totalAmount: 99 };
    expect(await checkPreCheckout(pay)).toBeNull();
    expect(await fulfillPayment({ ...pay, chargeId: 'ch-matrix' })).toBe('paid');
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned).toContain('matrix');
    expect(col.equipped).toEqual({ skin: 'cyber_samurai', effect: 'matrix' });
    expect(
      (await c.get('/api/shop')).json<ShopResponse>().products.find((p) => p.id === 'effect_matrix')!.owned,
    ).toBe(true);
    expect(code(await c.post('/api/shop/invoice', { productId: 'effect_matrix' }))).toBe('CONFLICT');

    await refundPurchase(purchase.id);
    const after = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(after.owned).not.toContain('matrix');
    expect(after.equipped).toEqual({ skin: 'cyber_samurai', effect: 'coins' });
  });

  it('catalog: 3 characters, all free, the starting one first; rarities are cosmetic only', () => {
    const skins = COSMETICS.filter((c) => c.kind === 'skin');
    expect(skins.map((s) => s.id)).toEqual(FREE_SKINS);
    expect(DEFAULT_SKIN_ID).toBe(FREE_SKINS[0]);
    expect(skins.every((s) => isFreeCosmetic(s))).toBe(true);
    expect(skins.filter((s) => s.unlockLeague !== undefined)).toEqual([]);
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
    // каждый предмет за Stars есть в магазине, и в магазине нет ничего, чего каталог не продаёт
    const starItems = COSMETICS.filter((c) => c.price?.currency === 'stars').map((c) => c.id);
    const shopItems = SHOP_PRODUCT_IDS.map((id) => SHOP[id].cosmeticId).filter(Boolean);
    expect(shopItems).toEqual(starItems);
  });

  it('migrations: old skins become their equivalents, then the starting character is Cyber Samurai', async () => {
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

    for (const name of ['20261005120000_skin_characters', '20261020120000_default_skin_cyber_samurai']) {
      const sql = readFileSync(
        new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
        'utf8',
      );
      const statements = sql
        .split(/;\s*$/m)
        .map((s) => s.replace(/^--.*$/gm, '').trim())
        .filter(Boolean);
      await prisma.$transaction(async (tx) => {
        for (const st of statements) await tx.$executeRawUnsafe(st);
      });
    }

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { cosmetics: true },
    });
    // стартовый персонаж той коллекции; убранный из каталога показывается как нынешний стартовый
    expect(after.equippedSkinId).toBe('neon_punk');
    expect(after.equippedEffectId).toBe('hearts');
    expect(after.balance.toNumber()).toBe(7_890);
    expect(after.totalEarned.toNumber()).toBe(123_456);
    // купленное остаётся в базе: вернётся к игроку, когда персонаж вернётся в каталог
    expect(after.cosmetics.map((c) => [c.cosmeticId, c.source]).sort()).toEqual([
      ['desert_nomad', 'coins'],
      ['hearts', 'coins'],
      ['shadow_drifter', 'stars'],
    ]);
    const other = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17011n } });
    expect(other.equippedSkinId).toBe('neon_punk');
    const c = client(app, tgUser(17010));
    expect((await c.get('/api/state')).json<StateResponse>().state.cosmetics).toEqual({
      skin: DEFAULT_SKIN_ID,
      effect: 'hearts',
    });
    // новый игрок после миграций — в Кибер-Самурае
    await player(17014);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17014n } });
    expect(fresh.equippedSkinId).toBe('cyber_samurai');
  });

  it('removed characters: shown as the default, open invoices are declined, a late payment is kept for the player', async () => {
    const c = await player(17012);
    await prisma.user.update({ where: { telegramId: 17012n }, data: { equippedSkinId: 'golden_boss' } });
    expect((await c.get('/api/state')).json<StateResponse>().state.cosmetics.skin).toBe(DEFAULT_SKIN_ID);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 17012n } });
    const invoice = (productId: string, cosmetic: string, stars: number) =>
      prisma.purchase.create({
        data: { userId: user.id, productId, stars, payload: `old-${productId}`, grant: { cosmetic } },
      });
    // счета, выставленные до обновления: персонаж убран, стал бесплатным или это скин прошлой коллекции
    const removed = await invoice('skin_royal_emperor', 'royal_emperor', 499);
    const nowFree = await invoice('skin_cyber_samurai', 'cyber_samurai', 299);
    const legacy = await invoice('skin_queen', 'queen', 249);
    for (const p of [removed, nowFree, legacy]) {
      expect(
        await checkPreCheckout({ payload: p.payload, fromId: 17012, currency: 'XTR', totalAmount: p.stars }),
      ).toBe('Этот предмет больше не продаётся');
    }

    // оплата всё же прошла (Telegram подтвердил до обновления): платёж принят, предмет записан игроку
    expect(
      await fulfillPayment({
        payload: removed.payload,
        fromId: 17012,
        currency: 'XTR',
        totalAmount: 499,
        chargeId: 'ch-removed',
      }),
    ).toBe('paid');
    expect(await prisma.userCosmetic.count({ where: { userId: user.id, cosmeticId: 'royal_emperor' } })).toBe(
      1,
    );
    const col = (await c.get('/api/collection')).json<CollectionResponse>();
    expect(col.owned).not.toContain('royal_emperor');
    expect(col.equipped.skin).toBe(DEFAULT_SKIN_ID);

    // возврат звёзд забирает запись
    setPaymentsGateway({ createInvoiceLink: () => Promise.resolve(''), refund: () => Promise.resolve() });
    await refundPurchase(removed.id);
    expect(await prisma.userCosmetic.count({ where: { userId: user.id, cosmeticId: 'royal_emperor' } })).toBe(
      0,
    );
    expect((await c.get('/api/collection')).json<CollectionResponse>().equipped.skin).toBe(DEFAULT_SKIN_ID);
  });

  it('equip validation: unknown id → 404, too long id → 400, rapid switching ends on the last request', async () => {
    const c = await player(17013, levelThreshold(5), 1_000_000);
    expect((await c.post('/api/collection/hamster_king/equip')).statusCode).toBe(404);
    expect((await c.post(`/api/collection/${'x'.repeat(41)}/equip`)).statusCode).toBe(400);
    for (const id of [...FREE_SKINS, ...FREE_SKINS])
      expect((await c.post(`/api/collection/${id}/equip`)).statusCode).toBe(200);
    expect((await c.get('/api/state')).json<StateResponse>().state.cosmetics.skin).toBe('shadow_drifter');
  });
});
