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
  | 'unauthorized'
  | 'deleted';

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
  /** показывать онбординг (первый вход) */
  onboarding: boolean;
  setStatus(status: BootStatus, message?: string | null): void;
  setLocale(locale: Locale): void;
  applyAuth(res: AuthResponse): void;
  applyState(state: PlayerState): void;
  dismissOffline(): void;
  finishOnboarding(): void;
  setOnline(online: boolean): void;
}

/**
 * В e2e-сборке онбординг пропускается, чтобы сценарии начинались с Офиса;
 * проверить его можно параметром ?onboarding=1.
 */
function skipOnboarding(): boolean {
  if (import.meta.env.MODE !== 'e2e' || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('onboarding') !== '1';
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
  onboarding: false,
  setStatus: (status, message = null) => set({ status, statusMessage: message }),
  setLocale: (locale) => set({ locale }),
  applyAuth: (res) =>
    set({
      player: res.state,
      config: res.config,
      offline: res.offline,
      clockOffset: res.state.serverTime - Date.now(),
      onboarding: !res.state.profile.onboardingDone && !skipOnboarding(),
      status: 'ready',
      statusMessage: null,
    }),
  applyState: (state) => set({ player: state, clockOffset: state.serverTime - Date.now() }),
  dismissOffline: () => set({ offline: null }),
  finishOnboarding: () => set({ onboarding: false }),
  setOnline: (online) => set({ online }),
}));
