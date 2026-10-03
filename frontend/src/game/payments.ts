import type { InvoiceResponse } from '@meowgul/shared';
import { endpoints } from '../api/endpoints';
import { isInsideTelegram, openInvoice } from '../telegram/webapp';
import { tapEngine } from './tapEngine';

/** Префикс счёта без Telegram (разработка, e2e): оплату имитирует сервер. */
const DEV_INVOICE_PREFIX = 'dev-invoice://';
/** сколько ждём, пока бот получит successful_payment и выдаст покупку */
const CONFIRM_ATTEMPTS = 20;
const CONFIRM_DELAY_MS = 1000;

export type PayResult = 'paid' | 'cancelled' | 'failed' | 'pending' | 'outside';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Дождаться выдачи покупки и применить новое состояние игрока. */
async function waitDelivered(purchaseId: number): Promise<boolean> {
  for (let i = 0; i < CONFIRM_ATTEMPTS; i++) {
    const res = await endpoints.purchaseStatus(purchaseId).catch(() => null);
    if (res?.status === 'paid' && res.state) {
      tapEngine.applyServerState(res.state);
      return true;
    }
    await sleep(CONFIRM_DELAY_MS);
  }
  return false;
}

/**
 * Оплата в Telegram Stars: выставить счёт, открыть его в Telegram и дождаться, пока бот выдаст покупку.
 * Общая для товаров магазина и открытия активов.
 */
export async function payInvoice(create: () => Promise<InvoiceResponse>): Promise<PayResult> {
  try {
    await tapEngine.flush();
    const invoice = await create();
    let status: PayResult;
    if (invoice.link.startsWith(DEV_INVOICE_PREFIX)) {
      await endpoints.devPay(invoice.purchaseId);
      status = 'paid';
    } else if (isInsideTelegram()) {
      status = await openInvoice(invoice.link);
    } else {
      return 'outside';
    }
    if (status !== 'paid') return status;
    return (await waitDelivered(invoice.purchaseId)) ? 'paid' : 'pending';
  } catch {
    return 'failed';
  }
}
