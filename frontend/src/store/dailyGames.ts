import type { CipherState, ComboState } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';

interface DailyGamesStore {
  combo: ComboState | null;
  cipher: CipherState | null;
  nextResetAt: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** id карточки, только что найденной в комбо, — для переворота слота */
  revealed: string | null;
  /** показать сцену «Комбо собрано!» */
  celebrate: number | null;
  load(force?: boolean): Promise<void>;
  setCombo(combo: ComboState, revealed?: string | null): void;
  setCipher(cipher: CipherState): void;
  celebrateCombo(reward: number): void;
  dismissCelebration(): void;
}

let inflight: Promise<void> | null = null;

export const useDailyGames = create<DailyGamesStore>((set, get) => ({
  combo: null,
  cipher: null,
  nextResetAt: 0,
  status: 'idle',
  revealed: null,
  celebrate: null,
  load: (force = false) => {
    const { status, nextResetAt } = get();
    if (!force && status === 'ready' && Date.now() < nextResetAt) return Promise.resolve();
    if (inflight) return inflight;
    if (status !== 'ready') set({ status: 'loading' });
    inflight = endpoints
      .dailyGames()
      .then((res) =>
        set({
          combo: res.combo,
          cipher: res.cipher,
          nextResetAt: res.nextResetAt,
          status: 'ready',
          revealed: null,
        }),
      )
      .catch(() => set({ status: get().combo ? 'ready' : 'error' }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  setCombo: (combo, revealed = null) => set({ combo, revealed }),
  setCipher: (cipher) => set({ cipher }),
  celebrateCombo: (reward) => set({ celebrate: reward }),
  dismissCelebration: () => set({ celebrate: null }),
}));
