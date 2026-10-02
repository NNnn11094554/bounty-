import { achievementById, formatInt, type Achievement } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isReducedMotion } from '../animations';
import { endpoints } from '../api/endpoints';
import { centerOf, flyCoins } from '../game/effects';
import { useLocale, useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useGame } from '../store/game';
import { useNav } from '../store/nav';
import { useOverlays } from '../store/overlays';
import { haptic } from '../telegram/webapp';
import { CardIcon } from './cards/CardIcon';
import { CoinIcon } from './icons';

const SHOW_MS = 3200;
/** уже показанные за сессию: состояние с сервера может прийти раньше, чем он узнает, что их видели */
const shownIds = new Set<string>();

/**
 * Всплывающее уведомление о достижении: плашка над нижним меню с иконкой, названием и наградой,
 * монеты летят в баланс. Несколько достижений показываются по очереди; ждёт, пока закроются модалки.
 */
export function AchievementPopup() {
  const t = useT();
  const locale = useLocale();
  const fresh = useGame((s) => s.player?.achievements.fresh);
  const blocking = useOverlays((s) => s.blocking > 0);
  const [queue, setQueue] = useState<Achievement[]>([]);
  const iconRef = useRef<HTMLDivElement>(null);

  // новые достижения — в очередь; сервер сразу узнаёт, что они показаны
  useEffect(() => {
    if (!fresh?.length) return;
    const added = fresh.filter((id) => !shownIds.has(id));
    if (!added.length) return;
    added.forEach((id) => shownIds.add(id));
    const items = added.map(achievementById).filter((a): a is Achievement => Boolean(a));
    setQueue((q) => [...q, ...items]);
    void endpoints.achievementsSeen(added).catch(() => undefined);
  }, [fresh]);

  const current = blocking ? undefined : queue[0];

  useEffect(() => {
    if (!current) return;
    haptic.notify('success');
    playSound('reward');
    const coins = window.setTimeout(
      () => flyCoins(centerOf(iconRef.current), isReducedMotion() ? 6 : 12),
      350,
    );
    const next = window.setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => {
      window.clearTimeout(coins);
      window.clearTimeout(next);
    };
  }, [current]);

  const open = () => {
    setQueue((q) => q.slice(1));
    useNav.getState().push('profile');
  };

  return createPortal(
    <div className="pb-safe pointer-events-none fixed inset-x-0 bottom-[92px] z-[58] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {current && (
          <motion.button
            key={current.id}
            type="button"
            onClick={open}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="pointer-events-auto relative flex w-full max-w-[420px] items-center gap-3 overflow-hidden rounded-[22px] border border-gold/40 bg-night-700 p-3 text-left shadow-glow"
            data-testid="achievement-popup"
            data-id={current.id}
          >
            {/* блик пробегает по плашке */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent"
              initial={{ x: '-120%' }}
              animate={{ x: '360%' }}
              transition={{ duration: 1.1, delay: 0.25, ease: 'easeOut' }}
            />
            <motion.div
              ref={iconRef}
              initial={{ rotate: -14, scale: 0.6 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.08 }}
              className="shrink-0"
            >
              <CardIcon icon={current.icon} size={52} />
            </motion.div>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-black uppercase tracking-wide text-gold">
                {t('achievements.new')}
              </span>
              <span className="block truncate text-[15px] font-extrabold">{current.name[locale]}</span>
              <span className="block truncate text-xs font-bold text-white/55">{current.desc[locale]}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-xl bg-gold/15 px-2 py-1 text-sm font-black text-gold">
              <CoinIcon size={16} />+{formatInt(current.reward)}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
