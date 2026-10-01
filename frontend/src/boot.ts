import { ApiError, onGlobalApiError, setInitData } from './api/client';
import { endpoints } from './api/endpoints';
import { resolveLocale } from './i18n';
import { useGame } from './store/game';
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
    const settings = res.state.profile.settings;
    store.setLocale(resolveLocale(settings.language, res.state.profile.languageCode));
    setHapticsEnabled(settings.vibration);
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
