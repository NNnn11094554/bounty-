import type { ShopProduct, ShopProductId } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';
import { payInvoice, type PayResult } from '../game/payments';

export type BuyResult = PayResult;

interface ShopStore {
  products: ShopProduct[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  buying: ShopProductId | null;
  load(): Promise<void>;
  buy(id: ShopProductId): Promise<BuyResult>;
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
      const result = await payInvoice(() => endpoints.createInvoice(id));
      if (result === 'paid' || result === 'pending') void get().load();
      return result;
    } finally {
      set({ buying: null });
    }
  },
}));
