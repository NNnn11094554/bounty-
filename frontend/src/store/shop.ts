import type { ShopProduct, ShopProductId } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';
import { tapEngine } from '../game/tapEngine';
import { openInvoice, isInsideTelegram } from '../telegram/webapp';

/** Префикс счёта без Telegram (разработка, e2e): оплату имитирует сервер. */
const DEV_INVOICE_PREFIX = 'dev-invoice://';
/** сколько ждём, пока бот получит successful_payment и выдаст покупку */
const CONFIRM_ATTEMPTS = 20;
const CONFIRM_DELAY_MS = 1000;

export type BuyResult = 'paid' | 'cancelled' | 'failed' | 'pending' | 'outside';

interface ShopStore {
  products: ShopProduct[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  buying: ShopProductId | null;
  load(): Promise<void>;
  buy(id: ShopProductId): Promise<BuyResult>;
}

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

export const useShop = create<ShopStore>((set, get) => ({
  products: [],
  status: 'idle',
  buying: null,
  load: async () => {
    if (get().status !== 'ready') set({ status: 'loading' });
    try {
      const res = await endpoints.shop();
      set({ products: res.products, status: 'ready' });
    } catch {
      set({ status: get().products.length ? 'ready' : 'error' });
    }
  },
  buy: async (id) => {
    if (get().buying) return 'pending';
    set({ buying: id });
    try {
      await tapEngine.flush();
      const invoice = await endpoints.createInvoice(id);
      let status: BuyResult;
      if (invoice.link.startsWith(DEV_INVOICE_PREFIX)) {
        await endpoints.devPay(invoice.purchaseId);
        status = 'paid';
      } else if (isInsideTelegram()) {
        status = await openInvoice(invoice.link);
      } else {
        return 'outside';
      }
      if (status !== 'paid') return status;
      const delivered = await waitDelivered(invoice.purchaseId);
      void get().load();
      return delivered ? 'paid' : 'pending';
    } catch {
      return 'failed';
    } finally {
      set({ buying: null });
    }
  },
}));
