import { useEffect, useState } from 'react';
import { ApiError, setInitData } from '../api/client';
import { endpoints } from '../api/endpoints';
import { obtainInitData } from '../boot';
import { Button } from '../components/Button';
import { Toaster } from '../components/Toaster';
import { resolveLocale } from '../i18n';
import { useGame } from '../store/game';
import { getWebApp } from '../telegram/webapp';
import { BroadcastsTab } from './BroadcastsTab';
import { CardsTab } from './CardsTab';
import { DailyTab } from './DailyTab';
import { useA, useAdminLocale } from './i18n';
import { PlayersTab } from './PlayersTab';
import { SettingsTab } from './SettingsTab';
import { StatsTab } from './StatsTab';
import { TasksTab } from './TasksTab';

const TABS = ['stats', 'players', 'cards', 'tasks', 'daily', 'broadcasts', 'settings'] as const;
type AdminTab = (typeof TABS)[number];

type Gate = 'loading' | 'ok' | 'denied' | 'no_telegram' | 'error';

/**
 * Админ-панель (/admin): вход тем же initData Telegram, доступ — только ADMIN_TELEGRAM_IDS
 * (проверяет сервер на каждом запросе; клиент лишь не показывает интерфейс остальным).
 */
export function AdminApp() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const setLocale = useAdminLocale((s) => s.set);
  const [gate, setGate] = useState<Gate>('loading');
  const [tab, setTab] = useState<AdminTab>(() => {
    const fromHash = window.location.hash.slice(1);
    return (TABS as readonly string[]).includes(fromHash) ? (fromHash as AdminTab) : 'stats';
  });

  useEffect(() => {
    getWebApp()?.ready();
    getWebApp()?.expand();
    setLocale(resolveLocale(null, getWebApp()?.initDataUnsafe.user?.language_code));
    void (async () => {
      try {
        const initData = await obtainInitData();
        if (!initData) {
          setGate('no_telegram');
          return;
        }
        setInitData(initData);
        const res = await endpoints.auth();
        // лиги и прочий конфиг нужны вкладкам админки (названия лиг)
        useGame.setState({ config: res.config });
        setGate(res.state.profile.isAdmin ? 'ok' : 'denied');
      } catch (err) {
        setGate(err instanceof ApiError && err.code === 'BANNED' ? 'denied' : 'error');
      }
    })();
  }, [setLocale]);

  useEffect(() => {
    window.history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  if (gate !== 'ok') {
    const text =
      gate === 'loading'
        ? a('loading')
        : gate === 'denied'
          ? a('deniedText')
          : gate === 'no_telegram'
            ? a('openInTelegram')
            : a('error');
    return (
      <div className="grid h-full place-items-center p-6 text-center" data-testid={`admin-${gate}`}>
        <div>
          {gate === 'denied' && <h1 className="mb-2 text-2xl font-black">{a('denied')}</h1>}
          <p className="text-sm font-bold text-white/60">{text}</p>
          {gate === 'error' && (
            <Button className="mt-4" onClick={() => window.location.reload()}>
              {a('retry')}
            </Button>
          )}
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="admin">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-night-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <h1 className="min-w-0 flex-1 truncate text-lg font-black">{a('title')}</h1>
          <button
            type="button"
            onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
            className="rounded-xl bg-night-700 px-2.5 py-1.5 text-xs font-black text-white/70"
          >
            {locale === 'ru' ? 'EN' : 'RU'}
          </button>
          <a href="/" className="rounded-xl bg-night-700 px-2.5 py-1.5 text-xs font-black text-white/70">
            {a('toGame')}
          </a>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-extrabold transition-colors ${
                t === tab ? 'bg-cta text-white shadow-button' : 'text-white/60'
              }`}
              data-testid={`admin-tab-${t}`}
            >
              {a(`tab.${t}`)}
            </button>
          ))}
        </nav>
      </header>
      <main className="pb-safe mx-auto max-w-5xl px-4 pb-10 pt-4">
        {tab === 'stats' && <StatsTab />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'cards' && <CardsTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'daily' && <DailyTab />}
        {tab === 'broadcasts' && <BroadcastsTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
      <Toaster />
    </div>
  );
}
