import { useEffect } from 'react';
import { boot } from './boot';
import { EffectsLayer } from './components/EffectsLayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PawBackground } from './components/PawBackground';
import { Toaster } from './components/Toaster';
import { useT } from './i18n';
import { GameShell } from './screens/GameShell';
import { Onboarding } from './screens/onboarding/Onboarding';
import { SplashScreen } from './screens/SplashScreen';
import { StatusScreen } from './screens/StatusScreen';
import { useGame } from './store/game';
import { openLink } from './telegram/webapp';
import { MINI_APP_URL } from './lib/links';

const BOT_URL = MINI_APP_URL;

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
        <>
          <GameShell />
          <Onboarding />
        </>
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
      <EffectsLayer />
      <Toaster />
    </ErrorBoundary>
  );
}
