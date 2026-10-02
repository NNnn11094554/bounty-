import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isReducedMotion } from '../animations';
import { confetti } from '../game/effects';
import { useBackHandler } from '../hooks/useBackHandler';
import { useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useGame } from '../store/game';
import { haptic } from '../telegram/webapp';
import { Button } from './Button';
import { LeagueAvatar } from './LeagueAvatar';
import { useBlockingOverlay } from '../store/overlays';

const storageKey = (userId: number) => `meowgul.league.${userId}`;

function readSeen(userId: number): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: number, level: number): void {
  try {
    window.localStorage.setItem(storageKey(userId), String(level));
  } catch {
    /* хранилище недоступно — сцена просто покажется только в текущей сессии */
  }
}

/**
 * Полноэкранная сцена новой лиги: затемнение, вращающиеся лучи, кот в кольце новой лиги
 * вылетает в центр, название появляется по буквам, конфетти и кнопка «Круто!».
 */
export function LeagueUpScene() {
  const t = useT();
  const userId = useGame((s) => s.player?.profile.id ?? null);
  const level = useGame((s) => s.player?.leagueLevel ?? null);
  const leagues = useGame((s) => s.config?.leagues ?? null);
  const [shown, setShown] = useState<number | null>(null);
  const known = useRef<number | null>(null);

  useEffect(() => {
    if (userId === null || level === null) return;
    if (known.current === null) {
      // первый расчёт после входа: показываем, если лига выросла, пока игрока не было
      const seen = readSeen(userId);
      known.current = Math.max(level, seen ?? level);
      if (seen !== null && level > seen) setShown(level);
      else if (seen === null) writeSeen(userId, level);
      return;
    }
    if (level > known.current) setShown(level);
    known.current = Math.max(known.current, level);
  }, [userId, level]);

  const close = () => {
    if (userId !== null && shown !== null) writeSeen(userId, shown);
    setShown(null);
  };
  useBackHandler(shown !== null, close);
  useBlockingOverlay(shown !== null);

  useEffect(() => {
    if (shown === null) return;
    playSound('league');
    haptic.notify('success');
    const timer = window.setTimeout(() => confetti(undefined, 140), isReducedMotion() ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [shown]);

  const league = shown !== null ? leagues?.[shown] : undefined;
  const reduced = isReducedMotion();
  const color = league?.color === 'rainbow' ? '#ffc93c' : (league?.color ?? '#ffc93c');

  return createPortal(
    <AnimatePresence>
      {league && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/90 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          data-testid="league-up"
        >
          {!reduced && (
            <motion.svg
              className="pointer-events-none absolute left-1/2 top-[42%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2"
              viewBox="-100 -100 200 200"
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            >
              {Array.from({ length: 16 }, (_, i) => (
                <path
                  key={i}
                  d="M0 0L-7 -100H7Z"
                  fill={color}
                  opacity={i % 2 ? 0.07 : 0.14}
                  transform={`rotate(${i * 22.5})`}
                />
              ))}
            </motion.svg>
          )}
          <motion.p
            className="relative text-sm font-black uppercase tracking-[0.25em] text-white/70"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {t('leagueUp.title')}
          </motion.p>
          <motion.div
            className="relative mt-6"
            initial={reduced ? { opacity: 0 } : { scale: 0.2, y: 260, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.1 }}
          >
            <LeagueAvatar league={league} size={200} />
          </motion.div>
          <h2
            className="relative mt-8 flex text-[40px] font-black leading-none"
            style={{ color }}
            aria-label={league.name}
            data-testid="league-up-name"
          >
            {[...league.name].map((ch, i) => (
              <motion.span
                key={`${ch}-${i}`}
                aria-hidden
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.4 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.55 + i * 0.07, type: 'spring', stiffness: 420, damping: 18 }}
              >
                {ch}
              </motion.span>
            ))}
          </h2>
          <motion.p
            className="relative mt-4 max-w-[300px] text-center text-[15px] font-semibold leading-snug text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 + league.name.length * 0.07 }}
          >
            {t('leagueUp.text')}
          </motion.p>
          <motion.div
            className="relative mt-8 w-full max-w-[340px]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + league.name.length * 0.07 }}
          >
            <Button block className="h-14 text-base" onClick={close} data-testid="league-up-close">
              {t('leagueUp.cool')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
