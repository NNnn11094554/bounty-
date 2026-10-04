import type { GoldenCoinEvent } from '@meowgul/shared';
import { create } from './create';

interface EventsStore {
  /** золотая монета, которая сейчас бежит (или скоро побежит) по экрану */
  goldenCoin: GoldenCoinEvent | null;
  showGoldenCoin(coin: GoldenCoinEvent): void;
  clearGoldenCoin(id: string): void;
}

export const useEvents = create<EventsStore>((set, get) => ({
  goldenCoin: null,
  showGoldenCoin: (coin) => set({ goldenCoin: coin }),
  clearGoldenCoin: (id) => {
    if (get().goldenCoin?.id === id) set({ goldenCoin: null });
  },
}));
