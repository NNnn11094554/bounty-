import { MORSE, decodeMorse, encodeMorse } from '@meowgul/shared';
import type {
  ApiErrorBody,
  CardUpgradeResponse,
  CipherClaimResponse,
  DailyGamesResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CIPHER_WORDS, CIPHER_WORD_RE } from '../src/game/config/ciphers.js';
import { REWARDS, comboReward } from '../src/game/config/rewards.js';
import { dayKey, previousDayKey } from '../src/game/dayKey.js';
import { prisma } from '../src/lib/db.js';
import { getCatalog } from '../src/services/cards.js';
import { comboCandidates, pickCombo } from '../src/services/dailyGames.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const ADMIN_ID = 999000999;

describe('morse and cipher words', () => {
  it('decodes every letter and rejects unknown codes', () => {
    for (const [letter, code] of Object.entries(MORSE)) expect(decodeMorse(code)).toBe(letter);
    expect(decodeMorse('......')).toBeNull();
    expect(encodeMorse('meow')).toEqual(['--', '.', '---', '.--']);
  });

  it('cipher words are 4–7 Latin letters, unique, with hints', () => {
    expect(CIPHER_WORDS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(CIPHER_WORDS.map((w) => w.word)).size).toBe(CIPHER_WORDS.length);
    for (const w of CIPHER_WORDS) {
      expect(w.word).toMatch(CIPHER_WORD_RE);
      expect(w.hintRu.length).toBeGreaterThan(3);
      expect(w.hintEn.length).toBeGreaterThan(3);
    }
  });
});

describe('daily combo and cipher', () => {
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

  async function player(id: number, balance = 0) {
    const c = client(app, tgUser(id));
    await c.post('/api/auth');
    const user = await prisma.user.update({ where: { telegramId: BigInt(id) }, data: { balance } });
    return { c, user };
  }

  it('random combo: 3 distinct cheap cards from different categories', async () => {
    const catalog = await getCatalog();
    const candidates = comboCandidates(catalog);
    expect(candidates.every((c) => !c.isLimited && c.baseCost <= 300_000)).toBe(true);
    for (let i = 0; i < 20; i++) {
      const ids = pickCombo(catalog);
      expect(new Set(ids).size).toBe(3);
      const categories = ids.map((id) => catalog.find((c) => c.id === id)!.category);
      expect(new Set(categories).size).toBe(3);
    }
  });

  it('GET /api/combo creates the day combo and cipher once and hides unknown cards', async () => {
    const { c } = await player(9001);
    const first = (await c.get('/api/combo')).json<DailyGamesResponse>();
    expect(first.combo.slots).toEqual([null, null, null]);
    // награды — от дохода в час; у нового игрока — минимальные
    expect(first.combo).toMatchObject({ rewarded: false, reward: REWARDS.combo.min });
    expect(first.cipher).toMatchObject({ solved: false, reward: REWARDS.cipher.min });
    expect(first.cipher.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(first)).not.toContain('"word"');
    const again = (await c.get('/api/combo')).json<DailyGamesResponse>();
    expect(again.cipher).toEqual(first.cipher);
    expect(await prisma.dailyCombo.count()).toBe(1);
    expect(first.nextResetAt).toBeGreaterThan(Date.now());
  });

  it('upgrading all three combo cards pays the combo reward once', async () => {
    const key = dayKey(new Date());
    await prisma.dailyCombo.create({ data: { dayKey: key, cardIds: ['doge', 'link', 'ton'] } });
    const { c, user } = await player(9002, 1_000_000);

    const other = (await c.post('/api/cards/not/upgrade')).json<CardUpgradeResponse>();
    expect(other.combo).toBeNull();

    const one = (await c.post('/api/cards/doge/upgrade')).json<CardUpgradeResponse>();
    expect(one.combo?.reward).toBe(0);
    expect(one.combo?.combo.slots.map((s) => s?.id ?? null)).toEqual(['doge', null, null]);
    // повторное улучшение той же карточки ничего не меняет
    await prisma.userCard.update({
      where: { userId_cardId: { userId: user.id, cardId: 'doge' } },
      data: { cooldownUntil: null },
    });
    expect((await c.post('/api/cards/doge/upgrade')).json<CardUpgradeResponse>().combo).toBeNull();

    await c.post('/api/cards/link/upgrade');
    const before = (await c.get('/api/state')).json<{ state: { balance: number } }>().state.balance;
    const last = (await c.post('/api/cards/ton/upgrade')).json<CardUpgradeResponse>();
    expect(last.combo).toMatchObject({
      reward: comboReward(last.state.profitPerHour),
      combo: { rewarded: true },
    });
    expect(last.state.balance).toBeGreaterThan(before + REWARDS.combo.min - 2_000);

    const games = (await c.get('/api/combo')).json<DailyGamesResponse>();
    expect(games.combo.slots.map((s) => s?.id)).toEqual(['doge', 'link', 'ton']);
    expect(await prisma.transaction.count({ where: { userId: user.id, type: 'combo_reward' } })).toBe(1);
  });

  it('progress of a previous day does not count today', async () => {
    const key = dayKey(new Date());
    await prisma.dailyCombo.create({ data: { dayKey: key, cardIds: ['doge', 'link', 'ton'] } });
    const { c, user } = await player(9003, 1_000_000);
    await prisma.userComboProgress.create({
      data: { userId: user.id, dayKey: previousDayKey(key), foundCardIds: ['doge', 'link'] },
    });
    const res = (await c.post('/api/cards/ton/upgrade')).json<CardUpgradeResponse>();
    expect(res.combo?.reward).toBe(0);
    expect(res.combo?.combo.slots.filter(Boolean)).toHaveLength(1);
  });

  it('cipher: wrong words count attempts, the right word pays once', async () => {
    const key = dayKey(new Date());
    await prisma.dailyCipher.create({ data: { dayKey: key, word: 'MEOW', hintRu: 'мяу', hintEn: 'meow' } });
    const { c, user } = await player(9004);

    const wrong = await c.post('/api/cipher/claim', { word: 'PURR' });
    expect(wrong.statusCode).toBe(409);
    expect(wrong.json<ApiErrorBody>().error.code).toBe('NOT_COMPLETED');
    expect((await c.post('/api/cipher/claim', { word: 'meow!' })).statusCode).toBe(400);

    const ok = await c.post('/api/cipher/claim', { word: ' meow ' });
    expect(ok.statusCode).toBe(200);
    const body = ok.json<CipherClaimResponse>();
    expect(body).toMatchObject({ reward: REWARDS.cipher.min, cipher: { solved: true, length: 4 } });
    expect(body.state.balance).toBeGreaterThanOrEqual(REWARDS.cipher.min);

    expect((await c.post('/api/cipher/claim', { word: 'MEOW' })).json<ApiErrorBody>().error.code).toBe(
      'ALREADY_DONE',
    );
    const entry = await prisma.userCipher.findUniqueOrThrow({
      where: { userId_dayKey: { userId: user.id, dayKey: key } },
    });
    expect(entry).toMatchObject({ solved: true, attempts: 2 });
    expect(await prisma.transaction.count({ where: { userId: user.id, type: 'cipher_reward' } })).toBe(1);
  });

  it('parallel cipher claims pay once', async () => {
    const key = dayKey(new Date());
    await prisma.dailyCipher.create({ data: { dayKey: key, word: 'TUNA' } });
    const { c, user } = await player(9005);
    const results = await Promise.all([1, 2, 3].map(() => c.post('/api/cipher/claim', { word: 'TUNA' })));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.balance.toNumber()).toBeLessThan(1_000_100);
  });

  it('admins schedule combos and ciphers for the coming days', async () => {
    const { c: admin } = await player(ADMIN_ID);
    const { c: someone } = await player(9006);
    const today = dayKey(new Date());
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

    expect((await someone.get('/api/admin/daily')).statusCode).toBe(403);
    const ok = await admin.put(`/api/admin/combo/${tomorrow}`, { cardIds: ['doge', 'link', 'ada'] });
    expect(ok.statusCode).toBe(200);
    expect(
      (await admin.put(`/api/admin/cipher/${tomorrow}`, { word: 'whisker', hintRu: 'ус' })).statusCode,
    ).toBe(200);

    const bad = [
      admin.put(`/api/admin/combo/${tomorrow}`, { cardIds: ['doge', 'doge', 'ada'] }),
      admin.put(`/api/admin/combo/${tomorrow}`, { cardIds: ['doge', 'nope', 'ada'] }),
      admin.put(`/api/admin/combo/${previousDayKey(today)}`, { cardIds: ['doge', 'link', 'ada'] }),
      admin.put(`/api/admin/combo/${tomorrow}`, { cardIds: ['doge', 'link', 'btc'] }), // BTC — за Stars
      admin.put(`/api/admin/cipher/${tomorrow}`, { word: 'CAT' }),
      admin.put(`/api/admin/cipher/${tomorrow}`, { word: 'КОТИК' }),
    ];
    for (const res of await Promise.all(bad)) expect(res.statusCode).toBe(400);

    const { days } = (await admin.get('/api/admin/daily')).json<{
      days: Array<{ dayKey: string; combo: { cardIds: string[] } | null; cipher: { word: string } | null }>;
    }>();
    expect(days).toHaveLength(7);
    expect(days[0]!.dayKey).toBe(today);
    expect(days[1]).toMatchObject({
      dayKey: tomorrow,
      combo: { cardIds: ['doge', 'link', 'ada'] },
      cipher: { word: 'WHISKER' },
    });
  });
});
