import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { DURATION, isReducedMotion } from '../animations';
import { BottomNav } from '../components/BottomNav';
import { OfflineIncomeSheet } from '../components/OfflineIncomeSheet';
import { useBackHandler } from '../hooks/useBackHandler';
import { useNav, type SubScreen, type Tab } from '../store/nav';
import { OfficeScreen } from './office/OfficeScreen';

const loadMine = () => import('./mine/MineScreen').then((m) => ({ default: m.MineScreen }));
const MineScreen = lazy(loadMine);
const BoostsScreen = lazy(() => import('./boosts/BoostsScreen').then((m) => ({ default: m.BoostsScreen })));

const TAB_ORDER: readonly Tab[] = ['office', 'mine', 'friends', 'earn', 'airdrop'];

function SubScreenView({ screen }: { screen: SubScreen }) {
  switch (screen) {
    case 'boosts':
      return <BoostsScreen />;
    default:
      return null;
  }
}

function TabView({ tab, onOpenBoosts }: { tab: Tab; onOpenBoosts: () => void }) {
  switch (tab) {
    case 'mine':
      return <MineScreen />;
    default:
      return <OfficeScreen onOpenBoosts={onOpenBoosts} />;
  }
}

/** Оболочка игры после входа: вкладки, экраны поверх вкладок, модалки. */
export function GameShell() {
  const tab = useNav((s) => s.tab);
  const stack = useNav((s) => s.stack);
  const push = useNav((s) => s.push);
  const pop = useNav((s) => s.pop);
  const top = stack[stack.length - 1];
  useBackHandler(stack.length > 0, pop);
  const reduced = isReducedMotion();
  const slide = reduced ? 0 : 48;

  // направление слайда — по порядку вкладок в меню
  const prevTab = useRef(tab);
  const direction = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(prevTab.current) ? 1 : -1;
  useEffect(() => {
    prevTab.current = tab;
  }, [tab]);

  // экран Mine подгружается заранее, пока игрок тапает
  useEffect(() => {
    const id = window.setTimeout(() => void loadMine(), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="pt-safe pb-safe relative mx-auto flex h-full max-w-[520px] flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={tab}
            custom={direction}
            className="absolute inset-0"
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * slide }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: -d * slide }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: DURATION.tabSwitch / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={null}>
              <TabView tab={tab} onOpenBoosts={() => push('boosts')} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {top && (
            <motion.div
              key={top}
              className="absolute inset-0 z-20 bg-app"
              initial={{ opacity: 0, x: slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slide }}
              transition={{ duration: DURATION.tabSwitch / 1000, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={null}>
                <SubScreenView screen={top} />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {!top && <BottomNav />}
      <OfflineIncomeSheet />
    </div>
  );
}
