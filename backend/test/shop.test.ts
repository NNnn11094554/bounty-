import type { AuthResponse, InvoiceResponse, PurchaseStatusResponse, ShopResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import type { Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBot } from '../src/bot/bot.js';
import { accruePassive } from '../src/game/passive.js';
import { prisma } from '../src/lib/db.js';
import { setPaymentsGateway, type StarsInvoice } from '../src/services/payments.js';
import { client, createApp, resetDb, tgUser } from './helpers.js';

const BOT_INFO = {
  id: 1,
  is_bot: true,
  first_name: 'Meowgul',
  username: 'meowgul_bot',
} as UserFromGetMe;

/** Платёжный шлюз-заглушка: запоминает счета и возвраты. */
function fakePayments() {
  const invoices: StarsInvoice[] = [];
  const refunds: Array<{ telegramId: number; chargeId: string }> = [];
  setPaymentsGateway({
    createInvoiceLink: (invoice) => {
      invoices.push(invoice);
      return Promise.resolve(`https://t.me/$invoice-${invoices.length}`);
    },
    refund: (telegramId, chargeId) => {
      refunds.push({ telegramId, chargeId });
      return Promise.resolve();
    },
  });
  return { invoices, refunds };
}

interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}
function recorder(calls: ApiCall[]): Transformer {
  return async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const result =
      method === 'answerPreCheckoutQuery'
        ? true
        : { message_id: calls.length, date: 0, chat: { id: 1, type: 'private', first_name: 'x' } };
    return { ok: true, result } as never;
  };
}

function preCheckout(fromId: number, payload: string, amount: number) {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    pre_checkout_query: {
      id: 'pcq-1',
      from: { id: fromId, is_bot: false, first_name: 'Cat', language_code: 'ru' },
      currency: 'XTR',
      total_amount: amount,
      invoice_payload: payload,
    },
  };
}

function successfulPayment(fromId: number, payload: string, amount: number, chargeId = 'charge-1') {
  return {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 5,
      date: Math.floor(Date.now() / 1000),
      chat: { id: fromId, type: 'private' as const, first_name: 'Cat' },
      from: { id: fromId, is_bot: false, first_name: 'Cat', language_code: 'ru' },
      successful_payment: {
        currency: 'XTR',
        total_amount: amount,
        invoice_payload: payload,
        telegram_payment_charge_id: chargeId,
        provider_payment_charge_id: '',
      },
    },
  };
}

describe('shop (Telegram Stars)', () => {
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

  async function newPlayer(id: number) {
    const c = client(app, tgUser(id));
    const auth = (await c.post('/api/auth')).json<AuthResponse>();
    return { c, auth };
  }

  it('products scale with income, bigger packs are a better deal', async () => {
    const { c } = await newPlayer(16001);
    const fresh = (await c.get('/api/shop')).json<ShopResponse>().products;
    expect(fresh.find((p) => p.id === 'coins_small')).toMatchObject({
      stars: 25,
      coins: 25_000,
      bonusPercent: null,
    });
    expect(fresh.find((p) => p.id === 'coins_medium')).toMatchObject({
      coins: 150_000,
      bonusPercent: 50,
      popular: true,
    });
    expect(fresh.find((p) => p.id === 'income_x2')).toMatchObject({ kind: 'income_boost', hours: 24 });

    await prisma.user.update({ where: { telegramId: 16001n }, data: { profitPerHour: 100_000n } });
    const rich = (await c.get('/api/shop')).json<ShopResponse>().products;
    expect(rich.find((p) => p.id === 'coins_small')!.coins).toBe(300_000);
    expect(rich.find((p) => p.id === 'coins_large')!.coins).toBe(4_500_000);
  });

  it('invoice → pre-checkout → payment credits coins once, not counted as earned', async () => {
    const pay = fakePayments();
    const { c, auth } = await newPlayer(16002);
    const res = await c.post('/api/shop/invoice', { productId: 'coins_medium' });
    expect(res.statusCode).toBe(200);
    const invoice = res.json<InvoiceResponse>();
    expect(invoice.link).toContain('https://t.me/');
    expect(pay.invoices[0]).toMatchObject({ stars: 100, title: 'Мешок монет' });
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: invoice.purchaseId } });
    expect(purchase.status).toBe('PENDING');

    // заказ виден как неоплаченный
    const pending = (await c.get(`/api/shop/purchases/${invoice.purchaseId}`)).json<PurchaseStatusResponse>();
    expect(pending).toEqual({ status: 'pending', state: null });

    const calls: ApiCall[] = [];
    const bot = createBot('1:test', BOT_INFO);
    bot.api.config.use(recorder(calls));
    // чужой пользователь и неверная сумма — отказ
    await bot.handleUpdate(preCheckout(99999, purchase.payload, 100));
    await bot.handleUpdate(preCheckout(16002, purchase.payload, 1));
    await bot.handleUpdate(preCheckout(16002, purchase.payload, 100));
    const answers = calls.filter((x) => x.method === 'answerPreCheckoutQuery').map((x) => x.payload.ok);
    expect(answers).toEqual([false, false, true]);

    await bot.handleUpdate(successfulPayment(16002, purchase.payload, 100));
    await bot.handleUpdate(successfulPayment(16002, purchase.payload, 100)); // повтор от Telegram
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 16002n } });
    expect(user.balance.toNumber()).toBeGreaterThanOrEqual(auth.state.balance + 150_000);
    expect(user.balance.toNumber()).toBeLessThan(auth.state.balance + 300_000);
    expect(user.totalEarned.toNumber()).toBeLessThan(150_000);
    const txs = await prisma.transaction.findMany({ where: { userId: user.id, type: 'shop_purchase' } });
    expect(txs).toHaveLength(1);
    expect(calls.filter((x) => x.method === 'sendMessage')).toHaveLength(1); // «Покупка зачислена» — один раз

    const paid = (await c.get(`/api/shop/purchases/${invoice.purchaseId}`)).json<PurchaseStatusResponse>();
    expect(paid.status).toBe('paid');
    expect(paid.state!.balance).toBe(user.balance.floor().toNumber());

    // оплаченный счёт повторно не принимается
    await bot.handleUpdate(preCheckout(16002, purchase.payload, 100));
    expect(calls.filter((x) => x.method === 'answerPreCheckoutQuery').at(-1)!.payload.ok).toBe(false);
  });

  it('energy refill and income ×2 (stacking)', async () => {
    fakePayments();
    const { c } = await newPlayer(16003);
    await prisma.user.update({ where: { telegramId: 16003n }, data: { energy: 10 } });
    const bot = createBot('1:test', BOT_INFO);
    bot.api.config.use(recorder([]));

    const buy = async (productId: string, charge: string) => {
      const inv = (await c.post('/api/shop/invoice', { productId })).json<InvoiceResponse>();
      const p = await prisma.purchase.findUniqueOrThrow({ where: { id: inv.purchaseId } });
      await bot.handleUpdate(successfulPayment(16003, p.payload, p.stars, charge));
      return (await c.get(`/api/shop/purchases/${inv.purchaseId}`)).json<PurchaseStatusResponse>().state!;
    };
    const afterEnergy = await buy('energy_refill', 'c-energy');
    expect(afterEnergy.energy).toBe(afterEnergy.maxEnergy);

    const first = await buy('income_x2', 'c-x2-1');
    expect(first.incomeBoostUntil! - Date.now()).toBeGreaterThan(23.9 * 3_600_000);
    const second = await buy('income_x2', 'c-x2-2');
    expect(second.incomeBoostUntil! - first.incomeBoostUntil!).toBeGreaterThan(23.9 * 3_600_000);
  });

  it('income ×2 doubles only the boosted part of passive income', () => {
    const t0 = new Date('2026-10-02T10:00:00Z');
    const plus = (h: number) => new Date(t0.getTime() + h * 3_600_000);
    expect(accruePassive(1000n, t0, plus(2)).amount.toNumber()).toBe(2000);
    expect(accruePassive(1000n, t0, plus(2), plus(24)).amount.toNumber()).toBe(4000);
    // буст закончился через час: 1 ч ×2 + 1 ч ×1
    expect(accruePassive(1000n, t0, plus(2), plus(1)).amount.toNumber()).toBe(3000);
    // офлайн дольше 3 ч: оплачиваются 3 ч, все под бустом
    expect(accruePassive(1000n, t0, plus(10), plus(24)).amount.toNumber()).toBe(6000);
  });

  it('admin refund returns the Stars and takes the coins back', async () => {
    const pay = fakePayments();
    const { c } = await newPlayer(16004);
    const inv = (await c.post('/api/shop/invoice', { productId: 'coins_small' })).json<InvoiceResponse>();
    const p = await prisma.purchase.findUniqueOrThrow({ where: { id: inv.purchaseId } });
    const bot = createBot('1:test', BOT_INFO);
    bot.api.config.use(recorder([]));
    await bot.handleUpdate(successfulPayment(16004, p.payload, p.stars, 'charge-refund'));
    const before = await prisma.user.findUniqueOrThrow({ where: { telegramId: 16004n } });

    const admin = client(app, tgUser(999000999)); // ADMIN_TELEGRAM_IDS из test/setup.ts
    await admin.post('/api/auth');
    // игрок не может вернуть сам себе
    expect((await c.post(`/api/admin/purchases/${p.id}/refund`)).statusCode).toBe(403);
    const res = await admin.post(`/api/admin/purchases/${p.id}/refund`);
    expect(res.statusCode).toBe(200);
    expect(pay.refunds).toEqual([{ telegramId: 16004, chargeId: 'charge-refund' }]);
    const after = await prisma.user.findUniqueOrThrow({ where: { telegramId: 16004n } });
    expect(after.balance.toNumber()).toBeLessThan(before.balance.toNumber() - 24_000);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('REFUNDED');
    // повторный возврат — конфликт
    expect((await admin.post(`/api/admin/purchases/${p.id}/refund`)).statusCode).toBe(409);
  });

  it('unknown products and other players’ purchases are rejected', async () => {
    fakePayments();
    const { c } = await newPlayer(16005);
    expect((await c.post('/api/shop/invoice', { productId: 'free_money' })).statusCode).toBe(400);
    const inv = (await c.post('/api/shop/invoice', { productId: 'coins_small' })).json<InvoiceResponse>();
    const { c: other } = await newPlayer(16006);
    expect((await other.get(`/api/shop/purchases/${inv.purchaseId}`)).statusCode).toBe(404);
  });
});
