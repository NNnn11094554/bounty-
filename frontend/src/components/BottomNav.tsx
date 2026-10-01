import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { SPRING } from '../animations';
import { useT, type MessageKey } from '../i18n';
import { playSound } from '../lib/sound';
import { useNav, type Tab } from '../store/nav';
import { haptic } from '../telegram/webapp';
import { MineNavIcon, OfficeNavIcon } from './navIcons';

interface TabDef {
  id: Tab;
  label: MessageKey;
  icon: (active: boolean) => ReactNode;
}

const NAV_TABS: readonly TabDef[] = [
  { id: 'office', label: 'nav.office', icon: (active) => <OfficeNavIcon active={active} /> },
  { id: 'mine', label: 'nav.mine', icon: (active) => <MineNavIcon active={active} /> },
];

/** Нижнее меню: подсветка переезжает между вкладками, активная иконка подпрыгивает. */
export function BottomNav() {
  const t = useT();
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);
  return (
    <nav
      className="relative z-30 mx-3 mb-2 mt-1 grid auto-cols-fr grid-flow-col gap-1 rounded-[24px] border border-line bg-night-700/95 p-1.5 shadow-card backdrop-blur"
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
            </motion.span>
            <span
              className={`relative text-[11px] font-extrabold ${active ? 'text-white' : 'text-white/55'}`}
            >
              {t(item.label)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
