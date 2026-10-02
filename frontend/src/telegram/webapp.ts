/** Типизированная обёртка над Telegram.WebApp — только то, что использует игра. */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotice = 'error' | 'success' | 'warning';

interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  secondary_bg_color?: string;
}

interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface BackButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: WebAppUser; start_param?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  ready(): void;
  expand(): void;
  close(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  isVersionAtLeast(version: string): boolean;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  onEvent(event: string, cb: () => void): void;
  showConfirm?(message: string, callback: (ok: boolean) => void): void;
  offEvent(event: string, cb: () => void): void;
  HapticFeedback: {
    impactOccurred(style: HapticStyle): void;
    notificationOccurred(type: HapticNotice): void;
    selectionChanged(): void;
  };
  BackButton: BackButton;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/** Открыто ли приложение внутри Telegram (есть подписанные initData). */
export function isInsideTelegram(): boolean {
  return Boolean(getWebApp()?.initData);
}

function supports(version: string): boolean {
  const app = getWebApp();
  return Boolean(app && app.isVersionAtLeast(version));
}

/** Первичная настройка окна Mini App: развернуть, запретить закрытие свайпом, цвета. */
export function setupWebApp(): void {
  const app = getWebApp();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    if (supports('7.7')) app.disableVerticalSwipes?.();
    if (supports('6.1')) {
      app.setHeaderColor?.('#02030a');
      app.setBackgroundColor?.('#02030a');
    }
    if (supports('7.10')) app.setBottomBarColor?.('#02030a');
    applySafeArea(app);
    app.onEvent('safeAreaChanged', () => applySafeArea(app));
    app.onEvent('contentSafeAreaChanged', () => applySafeArea(app));
  } catch (err) {
    console.warn('Telegram WebApp setup failed', err);
  }
}

function applySafeArea(app: TelegramWebApp): void {
  const root = document.documentElement.style;
  const top = (app.safeAreaInset?.top ?? 0) + (app.contentSafeAreaInset?.top ?? 0);
  const bottom = (app.safeAreaInset?.bottom ?? 0) + (app.contentSafeAreaInset?.bottom ?? 0);
  root.setProperty('--tg-safe-top', `${top}px`);
  root.setProperty('--tg-safe-bottom', `${bottom}px`);
}

let hapticsEnabled = true;
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export const haptic = {
  impact(style: HapticStyle = 'light'): void {
    if (!hapticsEnabled) return;
    try {
      getWebApp()?.HapticFeedback.impactOccurred(style);
    } catch {
      /* старые клиенты без HapticFeedback */
    }
  },
  notify(type: HapticNotice): void {
    if (!hapticsEnabled) return;
    try {
      getWebApp()?.HapticFeedback.notificationOccurred(type);
    } catch {
      /* старые клиенты без HapticFeedback */
    }
  },
  select(): void {
    if (!hapticsEnabled) return;
    try {
      getWebApp()?.HapticFeedback.selectionChanged();
    } catch {
      /* старые клиенты без HapticFeedback */
    }
  },
};

export function openLink(url: string): void {
  // вне Telegram скрипт SDK тоже создаёт WebApp, но его openTelegramLink уводит саму игру со страницы —
  // методы Telegram используем только внутри Telegram, в браузере — новая вкладка
  const app = isInsideTelegram() ? getWebApp() : null;
  if (url.startsWith('https://t.me/') && app) app.openTelegramLink(url);
  else if (app) app.openLink(url);
  else window.open(url, '_blank', 'noopener');
}
