import type { AuthResponse, GameConfig, Locale, OfflineIncome, PlayerState } from '@meowgul/shared';
import { create } from 'zustand';

export type BootStatus =
  | 'booting'
  | 'ready'
  | 'network'
  | 'error'
  | 'not_in_telegram'
  | 'banned'
  | 'maintenance'
  | 'outdated'
  | 'unauthorized';

interface GameStore {
  status: BootStatus;
  locale: Locale;
  statusMessage: string | null;
  player: PlayerState | null;
  config: GameConfig | null;
  offline: OfflineIncome | null;
  /** есть ли связь с сервером (по результатам последних запросов) */
  online: boolean;
  /** серверное время − локальное, мс */
  clockOffset: number;
  setStatus(status: BootStatus, message?: string | null): void;
  setLocale(locale: Locale): void;
  applyAuth(res: AuthResponse): void;
  applyState(state: PlayerState): void;
  dismissOffline(): void;
  setOnline(online: boolean): void;
}

export const useGame = create<GameStore>((set) => ({
  status: 'booting',
  locale: 'ru',
  statusMessage: null,
  player: null,
  config: null,
  offline: null,
  online: true,
  clockOffset: 0,
  setStatus: (status, message = null) => set({ status, statusMessage: message }),
  setLocale: (locale) => set({ locale }),
  applyAuth: (res) =>
    set({
      player: res.state,
      config: res.config,
      offline: res.offline,
      clockOffset: res.state.serverTime - Date.now(),
      status: 'ready',
      statusMessage: null,
    }),
  applyState: (state) => set({ player: state, clockOffset: state.serverTime - Date.now() }),
  dismissOffline: () => set({ offline: null }),
  setOnline: (online) => set({ online }),
}));
