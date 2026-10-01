import { useEffect } from 'react';
import { boot } from './boot';
import { CharacterImage } from './components/CharacterImage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CoinIcon } from './components/icons';
import { PawBackground } from './components/PawBackground';
import { useT } from './i18n';
import { formatInt } from '@meowgul/shared';
import { SplashScreen } from './screens/SplashScreen';
import { StatusScreen } from './screens/StatusScreen';
import { useGame } from './store/game';
import { openLink } from './telegram/webapp';

const BOT_URL = `https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'meowgul_bot'}/${import.meta.env.VITE_MINIAPP_SHORT_NAME ?? 'app'}`;

function Root() {
  const status = useGame((s) => s.status);
  const message = useGame((s) => s.statusMessage);
  const player = useGame((s) => s.player);
  const t = useT();

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (status !== 'network') return;
    const retry = () => void boot();
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, 5000);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [status]);

  switch (status) {
    case 'booting':
      return <SplashScreen />;
    case 'network':
      return (
        <StatusScreen
          testId="screen-network"
          title={t('error.network.title')}
          text={t('error.network.text')}
          action={{ label: t('common.retry'), onClick: () => void boot() }}
        />
      );
    case 'not_in_telegram':
      return (
        <StatusScreen
          testId="screen-not-telegram"
          sleepy={false}
          title={t('error.notTelegram.title')}
          text={t('error.notTelegram.text')}
          action={{ label: t('error.notTelegram.button'), onClick: () => openLink(BOT_URL) }}
        />
      );
    case 'banned':
      return (
        <StatusScreen
          testId="screen-banned"
          title={t('error.banned.title')}
          text={message ?? t('error.banned.text')}
        />
      );
    case 'maintenance':
      return (
        <StatusScreen
          testId="screen-maintenance"
          title={t('error.maintenance.title')}
          text={message || t('error.maintenance.text')}
          action={{ label: t('common.retry'), onClick: () => void boot() }}
        />
      );
    case 'outdated':
      return (
        <StatusScreen
          testId="screen-outdated"
          sleepy={false}
          title={t('error.outdated.title')}
          text={t('error.outdated.text')}
          action={{ label: t('common.reload'), onClick: () => window.location.reload() }}
        />
      );
    case 'unauthorized':
      return (
        <StatusScreen
          testId="screen-unauthorized"
          title={t('error.unauthorized.title')}
          text={t('error.unauthorized.text')}
        />
      );
    case 'error':
      return (
        <StatusScreen
          testId="screen-error"
          title={t('error.generic.title')}
          text={t('error.generic.text')}
          action={{ label: t('common.reload'), onClick: () => window.location.reload() }}
        />
      );
    case 'ready':
      return player ? (
        <main className="flex h-full flex-col items-center justify-center gap-5 px-4" data-testid="home">
          <div className="h-40 w-40 overflow-hidden rounded-full ring-4 ring-gold">
            <CharacterImage size={160} className="h-full w-full" />
          </div>
          <p className="text-lg font-bold">{player.profile.firstName}</p>
          <div className="flex items-center gap-2 text-4xl font-black tabular">
            <CoinIcon size={36} />
            {formatInt(player.balance)}
          </div>
        </main>
      ) : (
        <SplashScreen />
      );
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <PawBackground />
      <Root />
    </ErrorBoundary>
  );
}
