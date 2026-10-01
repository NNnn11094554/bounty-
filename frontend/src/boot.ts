import { setReducedMotion } from './animations';
import { ApiError, onGlobalApiError, setInitData } from './api/client';
import { endpoints } from './api/endpoints';
import { setTurboMultiplier, tapEngine } from './game/tapEngine';
import { resolveLocale, translate } from './i18n';
import { setSoundEnabled } from './lib/sound';
import { useGame } from './store/game';
import { useToasts } from './store/toasts';
import { getWebApp, setHapticsEnabled, setupWebApp } from './telegram/webapp';

/** Параметры моковой авторизации для разработки: ?uid=…&name=…&premium=1&ref=ref_…&lang=en */
function devParams(): Record<string, string> {
  const q = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {
    id: q.get('uid') ?? localStorage.getItem('dev_uid') ?? '100000001',
    first_name: q.get('name') ?? 'Dev',
    username: q.get('username') ?? 'dev_cat',
    language: q.get('lang') ?? 'ru',
    premium: q.get('premium') ?? '0',
  };
  const ref = q.get('ref');
  if (ref) params.start_param = ref;
  return params;
}

async function obtainInitData(): Promise<string | null> {
  const app = getWebApp();
  if (app?.initData) return app.initData;
  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
    const { initData } = await endpoints.devInitData(devParams());
    return initData;
  }
  return null;
}

function handleGlobalError(err: ApiError): void {
  const store = useGame.getState();
  if (err.code === 'BANNED') store.setStatus('banned', (err.details?.reason as string | undefined) ?? null);
  else if (err.code === 'MAINTENANCE') store.setStatus('maintenance', err.message);
  else if (err.code === 'OUTDATED_CLIENT') store.setStatus('outdated');
  else if (err.code === 'UNAUTHORIZED') store.setStatus('unauthorized');
}

let unsubscribe: (() => void) | null = null;
let engineWired = false;

const NETWORK_TOAST = 'network';

/** Связь движка тапов с остальным приложением: состояние в стор, сеть в тосты, отправка при сворачивании. */
function wireEngine(): void {
  if (engineWired) return;
  engineWired = true;
  tapEngine.subscribe((state) => useGame.getState().applyState(state));
  tapEngine.onSync = (ok, err) => {
    const store = useGame.getState();
    const toasts = useToasts.getState();
    if (ok) {
      if (!store.online) {
        store.setOnline(true);
        toasts.dismiss(NETWORK_TOAST);
        toasts.show({ kind: 'success', text: translate(store.locale, 'net.back') });
      }
    } else if (err instanceof ApiError && err.isNetwork && store.online) {
      store.setOnline(false);
      toasts.show({
        id: NETWORK_TOAST,
        kind: 'network',
        text: translate(store.locale, 'net.offline'),
        duration: 0,
      });
    }
  };
  const flushNow = () => void tapEngine.flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('online', flushNow);
  getWebApp()?.onEvent('viewportChanged', flushNow);
}

/** Применить настройки игрока к клиенту: язык, звук, вибрация, анимации. */
export function applyClientSettings(
  settings: {
    language: 'ru' | 'en' | null;
    sound: boolean;
    vibration: boolean;
    animations: 'full' | 'reduced';
  },
  telegramLang: string,
): void {
  useGame.getState().setLocale(resolveLocale(settings.language, telegramLang));
  setHapticsEnabled(settings.vibration);
  setSoundEnabled(settings.sound);
  setReducedMotion(settings.animations === 'reduced');
}

export async function boot(): Promise<void> {
  const store = useGame.getState();
  store.setLocale(resolveLocale(null, getWebApp()?.initDataUnsafe.user?.language_code));
  setupWebApp();
  unsubscribe ??= onGlobalApiError(handleGlobalError);
  store.setStatus('booting');
  try {
    const initData = await obtainInitData();
    if (!initData) {
      store.setStatus('not_in_telegram');
      return;
    }
    setInitData(initData);
    const res = await endpoints.auth();
    applyClientSettings(res.state.profile.settings, res.state.profile.languageCode);
    setTurboMultiplier(res.config.turbo.multiplier);
    wireEngine();
    tapEngine.applyServerState(res.state);
    tapEngine.start(res.config.tap.syncIntervalMs);
    store.applyAuth(res);
  } catch (err) {
    if (err instanceof ApiError) {
      if (['BANNED', 'MAINTENANCE', 'OUTDATED_CLIENT', 'UNAUTHORIZED'].includes(err.code)) return; // экран уже выставлен
      if (err.isNetwork) {
        store.setStatus('network');
        return;
      }
    }
    console.error('boot failed', err);
    store.setStatus('error');
  }
}
