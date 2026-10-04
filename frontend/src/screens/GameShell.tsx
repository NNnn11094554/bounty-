import { AnimatePresence, motion } from 'framer-motion';
import { lazy, startTransition, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { DURATION, EASING, isReducedMotion } from '../animations';
import { AchievementPopup } from '../components/AchievementPopup';
import { BottomNav } from '../components/BottomNav';
import { ComboCelebration } from '../components/ComboCelebration';
import { LeagueUpScene } from '../components/LeagueUpScene';
import { OfflineIncomeSheet } from '../components/OfflineIncomeSheet';
import { TabTutorial } from '../components/TabTutorial';
import { useBackHandler } from '../hooks/useBackHandler';
import { useDayRollover } from '../hooks/useDayRollover';
import { useLevelUp } from '../hooks/useLevelUp';
import { useNav, type SubScreen, type Tab } from '../store/nav';
import { OfficeTab } from './office/OfficeTab';

const loadMine = () => import('./mine/MineScreen').then((m) => ({ default: m.MineScreen }));
const MineScreen = lazy(loadMine);
const loadFriends = () => import('./friends/FriendsScreen').then((m) => ({ default: m.FriendsScreen }));
const FriendsScreen = lazy(loadFriends);
const AirdropScreen = lazy(() =>
  import('./airdrop/AirdropScreen').then((m) => ({ default: m.AirdropScreen })),
);
const loadEarn = () => import('./earn/EarnScreen').then((m) => ({ default: m.EarnScreen }));
const EarnScreen = lazy(loadEarn);
const BoostsScreen = lazy(() => import('./boosts/BoostsScreen').then((m) => ({ default: m.BoostsScreen })));
const LeaguesScreen = lazy(() =>
  import('./leagues/LeaguesScreen').then((m) => ({ default: m.LeaguesScreen })),
);
const loadShop = () => import('./shop/ShopScreen').then((m) => ({ default: m.ShopScreen }));
const ShopScreen = lazy(loadShop);
const loadCollection = () =>
  import('./collection/CollectionScreen').then((m) => ({ default: m.CollectionScreen }));
const CollectionScreen = lazy(loadCollection);
const ProfileScreen = lazy(() =>
  import('./profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);
const SettingsScreen = lazy(() =>
  import('./settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

function SubScreenView({ screen }: { screen: SubScreen }) {
  switch (screen) {
    case 'mine':
      return <MineScreen />;
    case 'earn':
      return <EarnScreen />;
    case 'boosts':
      return <BoostsScreen />;
    case 'leagues':
      return <LeaguesScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
}

function TabView({ tab, open }: { tab: Tab; open: (screen: SubScreen) => void }) {
  const setTab = useNav((s) => s.setTab);
  switch (tab) {
    case 'friends':
      return <FriendsScreen />;
    case 'shop':
      return <ShopScreen onOpenCollection={() => setTab('collection')} />;
    case 'airdrop':
      return <AirdropScreen />;
    case 'collection':
      return <CollectionScreen />;
    case 'profile':
      return <ProfileScreen />;
    default:
      return <OfficeTab open={open} onOpenTab={setTab} />;
  }
}

/** Кривая framer-motion из строки cubic-bezier(...) — те же токены, что в CSS. */
const bezier = (css: string) => css.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];

/**
 * Содержимое экрана рисуется кадром позже и прерываемо (startTransition): переключатель внизу и выезд
 * панели откликаются сразу, а длинный список строится, не задерживая касание.
 */
function Deferred({ instant, children }: { instant: boolean; children: ReactNode }) {
  const [ready, setReady] = useState(instant);
  useEffect(() => {
    if (ready) return;
    const id = requestAnimationFrame(() => startTransition(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [ready]);
  return ready ? children : null;
}

/** Оболочка игры после входа: вкладки, экраны поверх вкладок, модалки. */
export function GameShell() {
  const tab = useNav((s) => s.tab);
  const stack = useNav((s) => s.stack);
  const push = useNav((s) => s.push);
  const pop = useNav((s) => s.pop);
  const setTab = useNav((s) => s.setTab);
  const top = stack[stack.length - 1];
  useBackHandler(stack.length > 0, pop);
  // «Назад» на вкладке (не главной) — на главную: аппаратная кнопка Android не закрывает игру с полпути
  useBackHandler(stack.length === 0 && tab !== 'office', () => setTab('office'));
  useDayRollover();
  useLevelUp();
  const reduced = isReducedMotion();
  // вкладка сразу после входа появляется без задержки и проявления; следующие переключения — с ними
  const entered = useRef(false);
  useEffect(() => {
    entered.current = true;
  }, []);
  const instant = reduced || !entered.current;

  // экраны вкладок подгружаются заранее, пока игрок тапает
  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadMine();
      void loadEarn();
      void loadShop();
      void loadFriends();
      void loadCollection();
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    // shell-clip: обрезка без прокрутки — scrollIntoView/фокус во время въезда экрана не сдвигают всю игру вбок
    <div className="shell-clip pt-safe pb-safe relative mx-auto flex h-full max-w-[520px] flex-col">
      <main className="relative min-h-0 flex-1">
        {/*
          Вкладки переключают десятки раз за игру: старая исчезает сразу, новая проявляется за 150 мс только
          прозрачностью (CSS, на видеокарте). Два экрана никогда не видны одновременно — нет «двойных» кадров.
        */}
        <div key={tab} className="absolute inset-0" data-tab={tab}>
          <Suspense fallback={null}>
            <Deferred instant={instant}>
              <div className={instant ? 'h-full' : 'screen-in h-full'}>
                <TabView tab={tab} open={push} />
              </div>
            </Deferred>
          </Suspense>
        </div>
        {/* экран поверх вкладки — непрозрачная панель въезжает справа и уезжает туда же */}
        <AnimatePresence>
          {top && (
            <motion.div
              key={top}
              className="bg-space absolute inset-0 z-20 will-change-transform"
              data-subscreen={top}
              initial={reduced ? { opacity: 0 } : { transform: 'translate3d(100%, 0, 0)' }}
              animate={reduced ? { opacity: 1 } : { transform: 'translate3d(0%, 0, 0)' }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: DURATION.tabFade / 1000 } }
                  : {
                      transform: 'translate3d(100%, 0, 0)',
                      transition: { duration: DURATION.screenOut / 1000, ease: bezier(EASING.drawer) },
                    }
              }
              transition={
                reduced
                  ? { duration: DURATION.tabFade / 1000 }
                  : { duration: DURATION.screenIn / 1000, ease: bezier(EASING.drawer) }
              }
            >
              <Suspense fallback={null}>
                <Deferred instant={reduced}>
                  <SubScreenView screen={top} />
                </Deferred>
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {!top && <BottomNav />}
      <OfflineIncomeSheet />
      <LeagueUpScene />
      <ComboCelebration />
      <AchievementPopup />
      <TabTutorial screen={top ?? tab} />
    </div>
  );
}
