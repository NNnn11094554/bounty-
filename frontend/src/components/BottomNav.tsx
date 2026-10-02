import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SPRING } from '../animations';
import { useT, type MessageKey } from '../i18n';
import { playSound } from '../lib/sound';
import { useNav, type Tab } from '../store/nav';
import { haptic } from '../telegram/webapp';
import { useGame } from '../store/game';
import {
  AirdropNavIcon,
  CollectionNavIcon,
  FriendsNavIcon,
  OfficeNavIcon,
  ProfileNavIcon,
  ShopNavIcon,
} from './navIcons';

interface TabDef {
  id: Tab;
  label: MessageKey;
  icon: (active: boolean) => ReactNode;
}

const NAV_TABS: readonly TabDef[] = [
  { id: 'office', label: 'nav.office', icon: (active) => <OfficeNavIcon active={active} /> },
  { id: 'friends', label: 'nav.friends', icon: (active) => <FriendsNavIcon active={active} /> },
  { id: 'shop', label: 'nav.shop', icon: (active) => <ShopNavIcon active={active} /> },
  { id: 'airdrop', label: 'nav.airdrop', icon: (active) => <AirdropNavIcon active={active} /> },
  {
    id: 'collection',
    label: 'nav.collection',
    icon: (active) => <CollectionNavIcon active={active} />,
  },
  { id: 'profile', label: 'nav.profile', icon: (active) => <ProfileNavIcon active={active} /> },
];

/** Нижнее меню: подсветка переезжает между вкладками, активная иконка подпрыгивает. */
export function BottomNav() {
  const t = useT();
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  // точка на «Главной» — ежедневная награда ждёт в Earn (быстрая кнопка на главной)
  const dailyReady = useGame((s) => s.player?.daily.claimedToday === false);
  const badges: Partial<Record<Tab, boolean>> = { office: dailyReady && tab !== 'office' };
  return (
    <nav
      className="relative z-30 mx-2 mb-2 mt-1 grid auto-cols-fr grid-flow-col gap-0.5 rounded-[24px] border border-line bg-night-700 p-1 shadow-card"
      data-testid="bottom-nav"
    >
      {NAV_TABS.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (active) return;
              haptic.select();
              playSound('click');
              setTab(item.id);
            }}
            className="relative flex h-[54px] flex-col items-center justify-center gap-0.5 rounded-[18px]"
            data-testid={`nav-${item.id}`}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                layoutId="nav-highlight"
                className="absolute inset-0 rounded-[18px] bg-night-500"
                transition={SPRING.tab}
              />
            )}
            <motion.span
              className="relative"
              animate={active ? { y: [0, -6, 0], scale: [1, 1.12, 1] } : { y: 0, scale: 1 }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            >
              {item.icon(active)}
              {badges[item.id] && (
                <span
                  className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-night-700 bg-coral-to"
                  data-testid={`nav-badge-${item.id}`}
                />
              )}
            </motion.span>
            <span
              className={`relative max-w-full truncate text-[10px] font-extrabold tracking-[-0.02em] ${active ? 'text-white' : 'text-white/55'}`}
            >
              {t(item.label)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
