import { AnimatePresence, motion } from 'framer-motion';
import { lazy, startTransition, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { DURATION, isReducedMotion } from '../animations';
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
const CollectionScreen = lazy(() =>
  import('./collection/CollectionScreen').then((m) => ({ default: m.CollectionScreen })),
);
const ProfileScreen = lazy(() =>
  import('./profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);
const SettingsScreen = lazy(() =>
  import('./settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

const TAB_ORDER: readonly Tab[] = ['office', 'mine', 'friends', 'earn', 'shop', 'airdrop'];

function SubScreenView({ screen }: { screen: SubScreen }) {
  switch (screen) {
    case 'boosts':
      return <BoostsScreen />;
    case 'leagues':
      return <LeaguesScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'collection':
      return <CollectionScreen />;
  }
}

function TabView({ tab, open }: { tab: Tab; open: (screen: SubScreen) => void }) {
  switch (tab) {
    case 'mine':
      return <MineScreen />;
    case 'friends':
      return <FriendsScreen />;
    case 'earn':
      return <EarnScreen />;
    case 'airdrop':
      return <AirdropScreen />;
    case 'shop':
      return <ShopScreen onOpenCollection={() => open('collection')} />;
    default:
      return <OfficeTab open={open} />;
  }
}

/**
 * Сдвиг строкой transform, а не x: так framer-motion отдаёт анимацию браузеру (WAAPI) и она идёт на видеокарте
 * с частотой экрана, даже пока основной поток рисует новую вкладку.
 */
const shift = (px: number) => `translate3d(${px}px, 0, 0)`;

/**
 * Содержимое вкладки рисуется кадром позже и прерываемо (startTransition): сначала стартует анимация
 * перехода, и пока React строит длинный список карточек, она не замирает.
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
  const top = stack[stack.length - 1];
  useBackHandler(stack.length > 0, pop);
  useDayRollover();
  useLevelUp();
  const reduced = isReducedMotion();
  const slide = reduced ? 0 : 48;

  // направление слайда — по порядку вкладок в меню
  const prevTab = useRef(tab);
  // первая вкладка после входа появляется сразу, без отложенной отрисовки
  const firstTab = useRef(tab);
  const direction = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prevTab.current) ? 1 : -1;
  useEffect(() => {
    prevTab.current = tab;
  }, [tab]);

  // экраны вкладок подгружаются заранее, пока игрок тапает
  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadMine();
      void loadEarn();
      void loadShop();
      void loadFriends();
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="pt-safe pb-safe relative mx-auto flex h-full max-w-[520px] flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={tab}
            custom={direction}
            className="absolute inset-0 will-change-transform"
            variants={{
              enter: (d: number) => ({ opacity: 0, transform: shift(d * slide) }),
              center: { opacity: 1, transform: shift(0) },
              exit: (d: number) => ({ opacity: 0, transform: shift(-d * slide) }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: DURATION.tabSwitch / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={null}>
              <Deferred instant={reduced || tab === firstTab.current}>
                <TabView tab={tab} open={push} />
              </Deferred>
            </Suspense>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {top && (
            <motion.div
              key={top}
              className="bg-space absolute inset-0 z-20 will-change-transform"
              data-subscreen={top}
              initial={{ opacity: 0, transform: shift(slide) }}
              animate={{ opacity: 1, transform: shift(0) }}
              exit={{ opacity: 0, transform: shift(slide) }}
              transition={{ duration: DURATION.tabSwitch / 1000, ease: [0.22, 1, 0.36, 1] }}
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
