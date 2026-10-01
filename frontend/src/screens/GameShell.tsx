import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense } from 'react';
import { DURATION, isReducedMotion } from '../animations';
import { useBackHandler } from '../hooks/useBackHandler';
import { useNav, type SubScreen } from '../store/nav';
import { OfficeScreen } from './office/OfficeScreen';

const BoostsScreen = lazy(() => import('./boosts/BoostsScreen').then((m) => ({ default: m.BoostsScreen })));

function SubScreenView({ screen }: { screen: SubScreen }) {
  switch (screen) {
    case 'boosts':
      return <BoostsScreen />;
    default:
      return null;
  }
}

/** Оболочка игры после входа: вкладки, экраны поверх вкладок, модалки. */
export function GameShell() {
  const stack = useNav((s) => s.stack);
  const push = useNav((s) => s.push);
  const pop = useNav((s) => s.pop);
  const top = stack[stack.length - 1];
  useBackHandler(stack.length > 0, pop);
  const slide = isReducedMotion() ? 0 : 48;

  return (
    <div className="pt-safe pb-safe relative mx-auto flex h-full max-w-[520px] flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1">
        <OfficeScreen onOpenBoosts={() => push('boosts')} />
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
    </div>
  );
}
