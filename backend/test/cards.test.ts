import type { ApiErrorBody, CardUpgradeResponse, CardsResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CARDS,
  LIMITED_ROTATION,
  MAX_LEVEL_PROFIT,
  cardLevelCost,
  cardLevelProfit,
  cardTotalProfit,
} from '../src/game/config/cards.js';
import { prisma } from '../src/lib/db.js';
import {
  CARDS_ECONOMY_VERSION,
  getCatalog,
  invalidateCatalog,
  limitedWindow,
  retireLegacyCards,
  syncCardEconomy,
} from '../src/services/cards.js';
import { dayKey } from '../src/game/dayKey.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const config = (id: string) => {
  const card = CARDS.find((c) => c.id === id);
  if (!card) throw new Error(`no card ${id}`);
  return card;
};

describe('cards API', () => {
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

  async function player(id: number, data: Parameters<typeof prisma.user.update>[0]['data'] = {}) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    const user = await prisma.user.update({ where: { telegramId: BigInt(id) }, data });
    return { c, user };
  }

  async function setLevel(userId: number, cardId: string, level: number, cooldownUntil: Date | null = null) {
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, level, cooldownUntil },
      update: { level, cooldownUntil },
    });
  }

  const upgrade = (c: ReturnType<typeof client>, id: string) => c.post(`/api/cards/${id}/upgrade`);

  /** Сделать актив бесплатным (как правка в админке) — чтобы проверять условия отдельно от Stars. */
  async function makeFree(id: string) {
    await prisma.card.update({ where: { id }, data: { starsPrice: null } });
    invalidateCatalog();
  }

  it('lists assets with prices, profits, rarity, Stars prices and locks', async () => {
    const { c } = await player(5001);
    const res = await c.get('/api/cards');
    expect(res.statusCode).toBe(200);
    const { cards, serverTime } = res.json<CardsResponse>();
    expect(serverTime).toBeGreaterThan(0);
    expect(cards.filter((x) => !x.limited).length).toBe(CARDS.filter((x) => !x.isLimited).length);
    // в продаже одновременно два лимитированных события из ротации
    expect(cards.filter((x) => x.limited).length).toBe(LIMITED_ROTATION.concurrent);

    const doge = cards.find((x) => x.id === 'doge');
    expect(doge).toMatchObject({
      category: 'MEME',
      icon: 'token/DOGE/0',
      rarity: 'common',
      level: 0,
      profitPerHour: 0,
      nextPrice: config('doge').baseCost,
      nextProfit: config('doge').baseProfit,
      starsPrice: null,
      lock: null,
      available: true,
      cooldownUntil: null,
      limited: null,
      name: { ru: 'Dogecoin', en: 'Dogecoin' },
    });
    expect(cards.filter((x) => x.starsPrice === null).length).toBe(
      CARDS.filter((x) => x.starsPrice === null).length,
    );
    expect(cards.find((x) => x.id === 'btc')).toMatchObject({
      rarity: 'legendary',
      starsPrice: config('btc').starsPrice,
    });
    expect(cards.find((x) => x.id === 'shib')?.lock).toEqual({
      type: 'card',
      cardId: 'doge',
      level: 3,
      currentLevel: 0,
      name: { ru: 'Dogecoin', en: 'Dogecoin' },
    });
    expect(cards.find((x) => x.id === 'atom')?.lock).toEqual({ type: 'friends', count: 1, current: 0 });
    expect(cards.find((x) => x.id === 'avax')?.lock).toMatchObject({ type: 'league', level: 3 });
    expect(cards.find((x) => x.id === 'ldo')?.lock).toEqual({
      type: 'task',
      taskId: 'tg_channel',
      title: null,
    });
  });

  it('a Stars asset cannot be bought for coins until it is unlocked; then levels cost coins', async () => {
    const card = config('uni');
    expect(card.starsPrice).not.toBeNull();
    const { c, user } = await player(5016, { balance: 10_000_000 });
    await setLevel(user.id, 'link', 3); // условие открытия
    const res = await upgrade(c, 'uni');
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error).toMatchObject({
      code: 'LOCKED',
      details: { reason: 'stars', stars: card.starsPrice },
    });
    expect(await prisma.userCard.count({ where: { userId: user.id, cardId: 'uni' } })).toBe(0);
    // открыт (оплата Stars выдала 1-й уровень) — дальше прокачка за монеты
    await setLevel(user.id, 'uni', 1);
    const second = (await upgrade(c, 'uni')).json<CardUpgradeResponse>();
    expect(second.state.balance).toBe(10_000_000 - cardLevelCost(card, 2));
    expect(second.cards.find((x) => x.id === 'uni')).toMatchObject({ level: 2, starsPrice: null });
  });

  it('upgrades an asset: charges the price, adds profit per hour, writes the ledger', async () => {
    const card = config('doge');
    const { c, user } = await player(5002, { balance: 10_000 });
    const res = await upgrade(c, 'doge');
    expect(res.statusCode).toBe(200);
    const body = res.json<CardUpgradeResponse>();
    expect(body.profitDelta).toBe(card.baseProfit);
    expect(body.state.profitPerHour).toBe(card.baseProfit);
    expect(body.state.balance).toBe(10_000 - card.baseCost);
    const view = body.cards.find((x) => x.id === 'doge');
    expect(view).toMatchObject({
      level: 1,
      profitPerHour: card.baseProfit,
      nextPrice: cardLevelCost(card, 2),
      nextProfit: cardLevelProfit(card, 2),
    });

    const second = (await upgrade(c, 'doge')).json<CardUpgradeResponse>();
    expect(second.state.balance).toBe(10_000 - card.baseCost - cardLevelCost(card, 2));
    expect(second.state.profitPerHour).toBe(card.baseProfit + cardLevelProfit(card, 2));

    const txs = await prisma.transaction.findMany({ where: { userId: user.id, type: 'card_upgrade' } });
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.amount.toNumber()).sort((a, b) => a - b)).toEqual(
      [-cardLevelCost(card, 2), -card.baseCost].sort((a, b) => a - b),
    );
    const stored = await prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: user.id, cardId: 'doge' } },
    });
    expect(stored.level).toBe(2);
  });

  it('refuses when there are not enough coins', async () => {
    const { c, user } = await player(5003, { balance: 10 });
    const res = await upgrade(c, 'doge');
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('INSUFFICIENT_FUNDS');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.profitPerHour).toBe(0n);
    expect(await prisma.userCard.count({ where: { userId: user.id } })).toBe(0);
  });

  it('double click buys exactly one level', async () => {
    const card = config('doge');
    const { c, user } = await player(5004, { balance: card.baseCost + cardLevelCost(card, 2) - 1 });
    const results = await Promise.all([upgrade(c, 'doge'), upgrade(c, 'doge')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const stored = await prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: user.id, cardId: 'doge' } },
    });
    expect(stored.level).toBe(1);
  });

  it('asset condition unlocks the dependent asset', async () => {
    await makeFree('shib');
    const { c, user } = await player(5005, { balance: 10_000_000 });
    const locked = await upgrade(c, 'shib');
    expect(locked.statusCode).toBe(409);
    expect(locked.json<ApiErrorBody>().error).toMatchObject({
      code: 'LOCKED',
      details: {
        reason: 'condition',
        lock: { type: 'card', cardId: 'doge', level: 3, currentLevel: 0 },
      },
    });
    await setLevel(user.id, 'doge', 2);
    const res = (await upgrade(c, 'doge')).json<CardUpgradeResponse>();
    // вместе с купленным активом приходит открывшийся
    expect(res.cards.find((x) => x.id === 'shib')?.lock).toBeNull();
    expect((await upgrade(c, 'shib')).statusCode).toBe(200);
  });

  it('friends and league conditions', async () => {
    await makeFree('atom');
    await makeFree('avax');
    const { c, user } = await player(5006, { balance: 100_000_000 });
    expect((await upgrade(c, 'atom')).statusCode).toBe(409);
    const { user: friend } = await player(5007);
    await prisma.referral.create({ data: { inviterId: user.id, inviteeId: friend.id } });
    expect((await upgrade(c, 'atom')).statusCode).toBe(200);

    expect((await upgrade(c, 'avax')).statusCode).toBe(409);
    await prisma.user.update({ where: { id: user.id }, data: { leagueLevel: 3 } });
    expect((await upgrade(c, 'avax')).statusCode).toBe(200);
  });

  it('task condition is met when the task is done', async () => {
    await makeFree('ldo');
    const { c, user } = await player(5008, { balance: 100_000 });
    expect((await upgrade(c, 'ldo')).statusCode).toBe(409);
    await prisma.task.create({
      data: {
        id: 'tg_channel',
        type: 'TELEGRAM_CHANNEL',
        titleRu: 'Канал',
        titleEn: 'Channel',
        reward: 5000n,
      },
    });
    const list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.find((x) => x.id === 'ldo')?.lock).toEqual({
      type: 'task',
      taskId: 'tg_channel',
      title: { ru: 'Канал', en: 'Channel' },
    });
    await prisma.userTask.create({ data: { userId: user.id, taskId: 'tg_channel', status: 'DONE' } });
    expect((await upgrade(c, 'ldo')).statusCode).toBe(200);
  });

  it('conditions only gate the first level', async () => {
    const { c, user } = await player(5009, { balance: 100_000_000 });
    await setLevel(user.id, 'avax', 1);
    expect((await upgrade(c, 'avax')).statusCode).toBe(200);
  });

  it('cooldown after an upgrade of an expensive asset', async () => {
    const card = config('apt');
    expect(card.cooldownSec).toBeGreaterThan(0);
    const { c, user } = await player(5010, { balance: 100_000_000 });
    await setLevel(user.id, 'apt', 1);
    const before = Date.now();
    const res = (await upgrade(c, 'apt')).json<CardUpgradeResponse>();
    const view = res.cards.find((x) => x.id === 'apt');
    expect(view?.cooldownUntil).toBeGreaterThanOrEqual(before + card.cooldownSec * 1000);
    const again = await upgrade(c, 'apt');
    expect(again.statusCode).toBe(409);
    expect(again.json<ApiErrorBody>().error).toMatchObject({ code: 'COOLDOWN' });
    await setLevel(user.id, 'apt', 2, new Date(Date.now() - 1000));
    expect((await upgrade(c, 'apt')).statusCode).toBe(200);
  });

  it('max level cannot be exceeded', async () => {
    const card = config('doge');
    const { c, user } = await player(5011, { balance: 1e15 });
    await setLevel(user.id, 'doge', card.maxLevel);
    const res = await upgrade(c, 'doge');
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('LIMIT_REACHED');
    const view = (await c.get('/api/cards')).json<CardsResponse>().cards.find((x) => x.id === 'doge');
    expect(view).toMatchObject({ level: card.maxLevel, nextPrice: null, nextProfit: null });
  });

  it('limited events are sold only inside their window', async () => {
    await makeFree('ev_halving');
    const { c, user } = await player(5012, { balance: 100_000_000 });
    const now = Date.now();
    await prisma.card.update({
      where: { id: 'ev_halving' },
      data: { availableFrom: new Date(now - 3600_000), availableUntil: new Date(now + 3600_000) },
    });
    invalidateCatalog();
    let list = (await c.get('/api/cards')).json<CardsResponse>();
    const pumpkin = list.cards.find((x) => x.id === 'ev_halving');
    expect(pumpkin?.available).toBe(true);
    expect(pumpkin?.limited?.until).toBe(now + 3600_000);
    expect((await upgrade(c, 'ev_halving')).statusCode).toBe(200);

    await prisma.card.update({
      where: { id: 'ev_halving' },
      data: { availableFrom: new Date(now - 7200_000), availableUntil: new Date(now - 3600_000) },
    });
    invalidateCatalog();
    const expired = await upgrade(c, 'ev_halving');
    expect(expired.statusCode).toBe(409);
    expect(expired.json<ApiErrorBody>().error).toMatchObject({
      code: 'LOCKED',
      details: { reason: 'limited' },
    });
    // купленный актив остаётся в списке (и приносит прибыль), но улучшать его нельзя
    list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.find((x) => x.id === 'ev_halving')).toMatchObject({ level: 1, available: false });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.profitPerHour).toBe(config('ev_halving').baseProfit);
    expect(user.id).toBeGreaterThan(0);
  });

  it('rotation keeps exactly two limited cards on sale and cycles through all of them', async () => {
    const catalog = await getCatalog();
    const limited = catalog.filter((x) => x.isLimited);
    const start = Date.UTC(2026, 5, 1);
    const seen = new Set<string>();
    for (let h = 0; h < 24 * 60; h += 6) {
      const now = new Date(start + h * 3600_000);
      const active = limited.filter((x) => limitedWindow(x, catalog, now).active);
      expect(active.length).toBe(LIMITED_ROTATION.concurrent);
      for (const x of active) {
        const w = limitedWindow(x, catalog, now);
        expect(w.until!.getTime()).toBeGreaterThan(now.getTime());
        seen.add(x.id);
      }
      for (const x of limited.filter((y) => !active.includes(y))) {
        expect(limitedWindow(x, catalog, now).nextFrom!.getTime()).toBeGreaterThan(now.getTime());
      }
    }
    expect(seen.size).toBe(limited.length);
  });

  it('inactive cards are hidden and cannot be bought', async () => {
    const { c } = await player(5013, { balance: 100_000 });
    await prisma.card.update({ where: { id: 'doge' }, data: { isActive: false } });
    invalidateCatalog();
    const list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.find((x) => x.id === 'doge')).toBeUndefined();
    expect((await upgrade(c, 'doge')).statusCode).toBe(404);
  });

  it('validates the card id', async () => {
    const { c } = await player(5014);
    expect((await upgrade(c, 'no_such_card')).statusCode).toBe(404);
    expect((await upgrade(c, 'BAD-ID')).statusCode).toBe(400);
  });

  it('passive income from cards accrues up to 3 hours', async () => {
    const { c, user } = await player(5015, { balance: 0, profitPerHour: 3600n });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSyncAt: new Date(Date.now() - 2 * 3600_000) },
    });
    let state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.balance).toBeGreaterThanOrEqual(7200);
    expect(state.balance).toBeLessThan(7210);
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: 0, lastSyncAt: new Date(Date.now() - 10 * 3600_000) },
    });
    state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.balance).toBe(3 * 3600);
  });

  it('economy sync: cards are rewritten from config and profit per hour is recalculated once', async () => {
    const top = [...CARDS].sort((a, b) => b.baseCost - a.baseCost)[0]!;
    const cheap = config('doge');
    // в БД — старые цифры дорогой карточки, у игрока — старый завышенный доход
    await prisma.card.update({ where: { id: top.id }, data: { baseProfit: 30_000_000n } });
    const { user } = await player(5901, { profitPerHour: 31_000_000n });
    const { user: empty } = await player(5902, { profitPerHour: 777n });
    await setLevel(user.id, top.id, 1);
    await setLevel(user.id, cheap.id, 3);

    expect(await syncCardEconomy()).toEqual({ users: 1 });
    const card = await prisma.card.findUniqueOrThrow({ where: { id: top.id } });
    expect(Number(card.baseProfit)).toBeLessThanOrEqual(MAX_LEVEL_PROFIT);
    const expected = cardTotalProfit(top, 1) + cardTotalProfit(cheap, 3);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(Number(after.profitPerHour)).toBe(expected);
    expect(Number((await prisma.user.findUniqueOrThrow({ where: { id: empty.id } })).profitPerHour)).toBe(0);
    const saved = await prisma.appSetting.findUniqueOrThrow({ where: { key: 'cardsEconomyVersion' } });
    expect(saved.value).toBe(CARDS_ECONOMY_VERSION);

    // второй старт — ничего не трогает (правки админки после синхронизации сохраняются)
    await prisma.card.update({ where: { id: cheap.id }, data: { baseProfit: 1n } });
    expect(await syncCardEconomy()).toBeNull();
    expect(Number((await prisma.card.findUniqueOrThrow({ where: { id: cheap.id } })).baseProfit)).toBe(1);
  });

  it('legacy cards are retired once: coins spent on them come back, the cards and their combo are gone', async () => {
    // старая карточка первой экономики и созданная в админке — её трогать нельзя
    const legacyRow = {
      category: 'LAYER1' as const,
      nameRu: 'Спот-торговля',
      nameEn: 'Spot Trading',
      descRu: '',
      descEn: '',
      icon: 'candles/none/0',
      baseCost: 1000n,
      baseProfit: 200n,
      costMultiplier: 1.5,
      profitMultiplier: 1.2,
    };
    await prisma.card.create({ data: { id: 'mk_spot', ...legacyRow } });
    await prisma.card.create({ data: { id: 'custom_admin', ...legacyRow, nameRu: 'Своя', nameEn: 'Own' } });
    invalidateCatalog();
    const { user } = await player(5903, { balance: 50, profitPerHour: 200n + 240n + 999n });
    await setLevel(user.id, 'mk_spot', 2); // 1000 + 1500 монет, +200 +240 в час
    await setLevel(user.id, 'custom_admin', 1);
    const { user: other } = await player(5904, { balance: 7 });
    const today = dayKey();
    await prisma.dailyCombo.create({ data: { dayKey: today, cardIds: ['mk_spot', 'doge', 'link'] } });

    expect(await retireLegacyCards()).toEqual({ users: 1, refunded: 2500 });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.balance.toNumber()).toBeGreaterThanOrEqual(50 + 2500);
    expect(after.balance.toNumber()).toBeLessThan(50 + 2500 + 10); // + пассив за секунды теста
    expect(after.totalEarned.toNumber()).toBeLessThan(2500); // возврат не двигает лигу
    expect(Number(after.profitPerHour)).toBe(999);
    expect(await prisma.card.findUnique({ where: { id: 'mk_spot' } })).toBeNull();
    expect(await prisma.card.findUnique({ where: { id: 'custom_admin' } })).not.toBeNull();
    expect(await prisma.userCard.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.dailyCombo.findUnique({ where: { dayKey: today } })).toBeNull();
    const refund = await prisma.transaction.findFirstOrThrow({
      where: { userId: user.id, type: 'cards_refund' },
    });
    expect(refund.amount.toNumber()).toBe(2500);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).balance.toNumber()).toBe(7);
    // повторный запуск ничего не делает
    expect(await retireLegacyCards()).toEqual({ users: 0, refunded: 0 });
  });
});
