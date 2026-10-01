import type { ApiErrorBody, CardUpgradeResponse, CardsResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CARDS, LIMITED_ROTATION, cardLevelCost, cardLevelProfit } from '../src/game/config/cards.js';
import { prisma } from '../src/lib/db.js';
import { getCatalog, invalidateCatalog, limitedWindow } from '../src/services/cards.js';
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

  it('lists cards with prices, profits and locks', async () => {
    const { c } = await player(5001);
    const res = await c.get('/api/cards');
    expect(res.statusCode).toBe(200);
    const { cards, serverTime } = res.json<CardsResponse>();
    expect(serverTime).toBeGreaterThan(0);
    expect(cards.filter((x) => !x.limited).length).toBe(CARDS.filter((x) => !x.isLimited).length);
    // в продаже одновременно две лимитированные карточки из ротации
    expect(cards.filter((x) => x.limited).length).toBe(LIMITED_ROTATION.concurrent);

    const spot = cards.find((x) => x.id === 'mk_spot');
    expect(spot).toMatchObject({
      level: 0,
      profitPerHour: 0,
      nextPrice: config('mk_spot').baseCost,
      nextProfit: config('mk_spot').baseProfit,
      lock: null,
      available: true,
      cooldownUntil: null,
      limited: null,
      name: { ru: 'Спот-торговля', en: 'Spot Trading' },
    });
    expect(cards.find((x) => x.id === 'mk_margin20')?.lock).toEqual({
      type: 'card',
      cardId: 'mk_margin10',
      level: 5,
      currentLevel: 0,
      name: { ru: 'Маржа x10', en: 'Margin x10' },
    });
    expect(cards.find((x) => x.id === 'sp_laser')?.lock).toEqual({ type: 'friends', count: 1, current: 0 });
    expect(cards.find((x) => x.id === 'mk_otc')?.lock).toMatchObject({ type: 'league', level: 3 });
    expect(cards.find((x) => x.id === 'sp_yarn')?.lock).toEqual({
      type: 'task',
      taskId: 'tg_channel',
      title: null,
    });
  });

  it('upgrades a card: charges the price, adds profit per hour, writes the ledger', async () => {
    const card = config('mk_spot');
    const { c, user } = await player(5002, { balance: 10_000 });
    const res = await upgrade(c, 'mk_spot');
    expect(res.statusCode).toBe(200);
    const body = res.json<CardUpgradeResponse>();
    expect(body.profitDelta).toBe(card.baseProfit);
    expect(body.state.profitPerHour).toBe(card.baseProfit);
    expect(body.state.balance).toBe(10_000 - card.baseCost);
    const view = body.cards.find((x) => x.id === 'mk_spot');
    expect(view).toMatchObject({
      level: 1,
      profitPerHour: card.baseProfit,
      nextPrice: cardLevelCost(card, 2),
      nextProfit: cardLevelProfit(card, 2),
    });

    const second = (await upgrade(c, 'mk_spot')).json<CardUpgradeResponse>();
    expect(second.state.balance).toBe(10_000 - card.baseCost - cardLevelCost(card, 2));
    expect(second.state.profitPerHour).toBe(card.baseProfit + cardLevelProfit(card, 2));

    const txs = await prisma.transaction.findMany({ where: { userId: user.id, type: 'card_upgrade' } });
    expect(txs).toHaveLength(2);
    expect(txs.map((t) => t.amount.toNumber()).sort((a, b) => a - b)).toEqual(
      [-cardLevelCost(card, 2), -card.baseCost].sort((a, b) => a - b),
    );
    const stored = await prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: user.id, cardId: 'mk_spot' } },
    });
    expect(stored.level).toBe(2);
  });

  it('refuses when there are not enough coins', async () => {
    const { c, user } = await player(5003, { balance: 10 });
    const res = await upgrade(c, 'mk_spot');
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('INSUFFICIENT_FUNDS');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.profitPerHour).toBe(0n);
    expect(await prisma.userCard.count({ where: { userId: user.id } })).toBe(0);
  });

  it('double click buys exactly one level', async () => {
    const card = config('mk_spot');
    const { c, user } = await player(5004, { balance: card.baseCost + cardLevelCost(card, 2) - 1 });
    const results = await Promise.all([upgrade(c, 'mk_spot'), upgrade(c, 'mk_spot')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const stored = await prisma.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: user.id, cardId: 'mk_spot' } },
    });
    expect(stored.level).toBe(1);
  });

  it('card condition unlocks the dependent card', async () => {
    const { c, user } = await player(5005, { balance: 10_000_000 });
    const locked = await upgrade(c, 'mk_margin20');
    expect(locked.statusCode).toBe(409);
    expect(locked.json<ApiErrorBody>().error).toMatchObject({
      code: 'LOCKED',
      details: {
        reason: 'condition',
        lock: { type: 'card', cardId: 'mk_margin10', level: 5, currentLevel: 0 },
      },
    });
    await setLevel(user.id, 'mk_margin10', 4);
    const res = (await upgrade(c, 'mk_margin10')).json<CardUpgradeResponse>();
    // вместе с купленной карточкой приходит открывшаяся
    expect(res.cards.find((x) => x.id === 'mk_margin20')?.lock).toBeNull();
    expect((await upgrade(c, 'mk_margin20')).statusCode).toBe(200);
  });

  it('friends and league conditions', async () => {
    const { c, user } = await player(5006, { balance: 100_000_000 });
    expect((await upgrade(c, 'sp_laser')).statusCode).toBe(409);
    const { user: friend } = await player(5007);
    await prisma.referral.create({ data: { inviterId: user.id, inviteeId: friend.id } });
    expect((await upgrade(c, 'sp_laser')).statusCode).toBe(200);

    expect((await upgrade(c, 'mk_otc')).statusCode).toBe(409);
    await prisma.user.update({ where: { id: user.id }, data: { leagueLevel: 3 } });
    expect((await upgrade(c, 'mk_otc')).statusCode).toBe(200);
  });

  it('task condition is met when the task is done', async () => {
    const { c, user } = await player(5008, { balance: 100_000 });
    expect((await upgrade(c, 'sp_yarn')).statusCode).toBe(409);
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
    expect(list.cards.find((x) => x.id === 'sp_yarn')?.lock).toEqual({
      type: 'task',
      taskId: 'tg_channel',
      title: { ru: 'Канал', en: 'Channel' },
    });
    await prisma.userTask.create({ data: { userId: user.id, taskId: 'tg_channel', status: 'DONE' } });
    expect((await upgrade(c, 'sp_yarn')).statusCode).toBe(200);
  });

  it('conditions only gate the first level', async () => {
    const { c, user } = await player(5009, { balance: 100_000_000 });
    await setLevel(user.id, 'mk_otc', 1);
    expect((await upgrade(c, 'mk_otc')).statusCode).toBe(200);
  });

  it('cooldown after an upgrade of an expensive card', async () => {
    const card = config('mk_insurance_fund');
    expect(card.cooldownSec).toBeGreaterThan(0);
    const { c, user } = await player(5010, { balance: 100_000_000 });
    await setLevel(user.id, 'mk_insurance_fund', 1);
    const before = Date.now();
    const res = (await upgrade(c, 'mk_insurance_fund')).json<CardUpgradeResponse>();
    const view = res.cards.find((x) => x.id === 'mk_insurance_fund');
    expect(view?.cooldownUntil).toBeGreaterThanOrEqual(before + card.cooldownSec * 1000);
    const again = await upgrade(c, 'mk_insurance_fund');
    expect(again.statusCode).toBe(409);
    expect(again.json<ApiErrorBody>().error).toMatchObject({ code: 'COOLDOWN' });
    await setLevel(user.id, 'mk_insurance_fund', 2, new Date(Date.now() - 1000));
    expect((await upgrade(c, 'mk_insurance_fund')).statusCode).toBe(200);
  });

  it('max level cannot be exceeded', async () => {
    const card = config('mk_spot');
    const { c, user } = await player(5011, { balance: 1e15 });
    await setLevel(user.id, 'mk_spot', card.maxLevel);
    const res = await upgrade(c, 'mk_spot');
    expect(res.statusCode).toBe(409);
    expect(res.json<ApiErrorBody>().error.code).toBe('LIMIT_REACHED');
    const view = (await c.get('/api/cards')).json<CardsResponse>().cards.find((x) => x.id === 'mk_spot');
    expect(view).toMatchObject({ level: card.maxLevel, nextPrice: null, nextProfit: null });
  });

  it('limited cards are sold only inside their window', async () => {
    const { c, user } = await player(5012, { balance: 100_000_000 });
    const now = Date.now();
    await prisma.card.update({
      where: { id: 'lt_pumpkin' },
      data: { availableFrom: new Date(now - 3600_000), availableUntil: new Date(now + 3600_000) },
    });
    invalidateCatalog();
    let list = (await c.get('/api/cards')).json<CardsResponse>();
    const pumpkin = list.cards.find((x) => x.id === 'lt_pumpkin');
    expect(pumpkin?.available).toBe(true);
    expect(pumpkin?.limited?.until).toBe(now + 3600_000);
    expect((await upgrade(c, 'lt_pumpkin')).statusCode).toBe(200);

    await prisma.card.update({
      where: { id: 'lt_pumpkin' },
      data: { availableFrom: new Date(now - 7200_000), availableUntil: new Date(now - 3600_000) },
    });
    invalidateCatalog();
    const expired = await upgrade(c, 'lt_pumpkin');
    expect(expired.statusCode).toBe(409);
    expect(expired.json<ApiErrorBody>().error).toMatchObject({
      code: 'LOCKED',
      details: { reason: 'limited' },
    });
    // купленная карточка остаётся в списке (и приносит прибыль), но улучшать её нельзя
    list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.find((x) => x.id === 'lt_pumpkin')).toMatchObject({ level: 1, available: false });
    const state = (await c.get('/api/state')).json<StateResponse>().state;
    expect(state.profitPerHour).toBe(config('lt_pumpkin').baseProfit);
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
    await prisma.card.update({ where: { id: 'mk_spot' }, data: { isActive: false } });
    invalidateCatalog();
    const list = (await c.get('/api/cards')).json<CardsResponse>();
    expect(list.cards.find((x) => x.id === 'mk_spot')).toBeUndefined();
    expect((await upgrade(c, 'mk_spot')).statusCode).toBe(404);
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
});
