import { AnimatePresence, motion } from 'framer-motion';
import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DURATION, EASING, isReducedMotion } from '../animations';
import { AchievementPopup } from '../components/AchievementPopup';
import { BottomNav } from '../components/BottomNav';
import { ComboCelebration } from '../components/ComboCelebration';
import { LeagueUpScene } from '../components/LeagueUpScene';
import { OfflineIncomeSheet } from '../components/OfflineIncomeSheet';
import { TabLayer } from '../components/TabLayer';
import { TabTutorial } from '../components/TabTutorial';
import { msSinceTouch } from '../game/frameLoop';
import { useBackHandler } from '../hooks/useBackHandler';
import { useDayRollover } from '../hooks/useDayRollover';
import { useLevelUp } from '../hooks/useLevelUp';
import { useNav, type SubScreen, type Tab } from '../store/nav';
import { OfficeTab } from './office/OfficeTab';

const loadMine = () => import('./mine/MineScreen').then((m) => ({ default: m.MineScreen }));
const MineScreen = lazy(loadMine);
const loadFriends = () => import('./friends/FriendsScreen').then((m) => ({ default: m.FriendsScreen }));
const FriendsScreen = lazy(loadFriends);
const loadAirdrop = () => import('./airdrop/AirdropScreen').then((m) => ({ default: m.AirdropScreen }));
const AirdropScreen = lazy(loadAirdrop);
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
const loadProfile = () => import('./profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen }));
const ProfileScreen = lazy(loadProfile);
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

/**
 * Экран вкладки. memo: перерисовка оболочки (смена вкладки, экран поверх) не перерисовывает экраны — при
 * показе замороженной вкладки React перерисовывает только то, что изменилось, пока она была скрыта.
 */
const TabView = memo(function TabView({ tab, open }: { tab: Tab; open: (screen: SubScreen) => void }) {
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
});

/** Кривая framer-motion из строки cubic-bezier(...) — те же токены, что в CSS. */
const bezier = (css: string) => css.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];

/** сколько игрок не касался экрана, прежде чем строить вкладки заранее */
const WARM_QUIET_MS = 2000;

/** порядок, в котором вкладки строятся заранее, пока игрок на главной (самые частые — первыми) */
const WARM_ORDER: readonly Tab[] = ['shop', 'collection', 'friends', 'profile', 'airdrop'];

/** Свободное время браузера (requestIdleCallback; в старых WebView — таймер). */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 300);
  return () => window.clearTimeout(id);
}

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

  /*
    Переключение вкладок. Вкладки не пересоздаются: построенная однажды остаётся и замораживается, когда скрыта
    (TabLayer), — показ готовой вкладки не строит экран заново и не грузит его повторно. Показ — в том же кадре,
    что и нажатие (layout-эффект, до отрисовки). Вкладку, которую ещё не строили, React строит невидимой и
    прерываемо (startTransition): нижнее меню откликается сразу, а на экране до её готовности остаётся прежняя
    — без пустого кадра.
  */
  const [mounted, setMounted] = useState<readonly Tab[]>(() => [tab]);
  const [ready, setReady] = useState<Partial<Record<Tab, true>>>({});
  const [shown, setShown] = useState<Tab>(tab);
  const onReady = useCallback((t: Tab) => setReady((r) => (r[t] ? r : { ...r, [t]: true })), []);
  useEffect(() => {
    if (!mounted.includes(tab)) startTransition(() => setMounted((m) => (m.includes(tab) ? m : [...m, tab])));
  }, [mounted, tab]);
  useLayoutEffect(() => {
    if (shown !== tab && ready[tab]) setShown(tab);
  }, [ready, shown, tab]);

  // экран поверх вкладки въехал и закрыл её целиком — вкладка под ним заморожена (не анимируется и не
  // перерисовывается, пока её не видно); при закрытии экрана оживает до первого кадра его выезда
  const [covered, setCovered] = useState(false);
  useLayoutEffect(() => {
    if (!top) setCovered(false);
  }, [top]);

  // первая вкладка после входа появляется без проявления; следующие показы — с ним
  const entered = useRef(false);
  useEffect(() => {
    entered.current = true;
  }, []);
  const fade = !reduced && entered.current;

  // экраны вкладок подгружаются заранее, пока игрок тапает…
  const [chunks, setChunks] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      void Promise.all([
        loadMine(),
        loadEarn(),
        loadShop(),
        loadFriends(),
        loadCollection(),
        loadProfile(),
        loadAirdrop(),
      ])
        .then(() => setChunks(true))
        .catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);
  // …и строятся невидимыми по одной в свободное время: первое открытие вкладки — тоже без задержки. Только в
  // паузе (игрок не касался экрана ~2 с): построение экрана не отнимает время у тапов сразу после входа
  useEffect(() => {
    if (!chunks) return;
    const next = WARM_ORDER.find((t) => !mounted.includes(t));
    if (!next || mounted.some((t) => !ready[t])) return;
    let cancel: () => void = () => undefined;
    const attempt = () => {
      const wait = WARM_QUIET_MS - msSinceTouch();
      if (wait > 0) {
        const id = window.setTimeout(attempt, wait);
        cancel = () => window.clearTimeout(id);
        return;
      }
      cancel = whenIdle(() =>
        startTransition(() => setMounted((m) => (m.includes(next) ? m : [...m, next]))),
      );
    };
    attempt();
    return () => cancel();
  }, [chunks, mounted, ready]);

  return (
    // shell-clip: обрезка без прокрутки — scrollIntoView/фокус во время въезда экрана не сдвигают всю игру вбок
    <div className="shell-clip pt-safe pb-safe relative mx-auto flex h-full max-w-[520px] flex-col">
      <main className="relative min-h-0 flex-1">
        {mounted.map((t) => (
          <TabLayer
            key={t}
            tab={t}
            visible={t === shown}
            ready={Boolean(ready[t])}
            covered={covered && t === shown}
            fade={fade}
            onReady={onReady}
          >
            <TabView tab={t} open={push} />
          </TabLayer>
        ))}
        {/* экран поверх вкладки — непрозрачная панель въезжает справа и уезжает туда же */}
        <AnimatePresence>
          {top && (
            <motion.div
              key={top}
              className="bg-space absolute inset-0 z-20 will-change-transform"
              data-subscreen={top}
              onAnimationComplete={() => {
                // въезд закончился (выезд — экран уже убран из стека)
                if (useNav.getState().stack.length) setCovered(true);
              }}
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
      <TabTutorial screen={top ?? shown} />
    </div>
  );
}
