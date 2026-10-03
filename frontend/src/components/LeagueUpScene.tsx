import { leagueRewardSkins, type CosmeticDef } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isReducedMotion } from '../animations';
import { confetti } from '../game/effects';
import { useBackHandler } from '../hooks/useBackHandler';
import { useLocale, useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useCollection } from '../store/collection';
import { useGame } from '../store/game';
import { haptic } from '../telegram/webapp';
import { Button } from './Button';
import { HeroBust } from './hero/HeroFigure';
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

/** Скины-награды за лиги, пройденные с from (не включая) до to (включая). */
function rewardsBetween(from: number, to: number): CosmeticDef[] {
  const out: CosmeticDef[] = [];
  for (let l = from + 1; l <= to; l++) out.push(...leagueRewardSkins(l));
  return out;
}

/**
 * Полноэкранная сцена новой лиги: затемнение, вращающиеся лучи, кот в кольце новой лиги
 * вылетает в центр, название появляется по буквам, конфетти и кнопка «Круто!». Если лига открыла
 * персонажа-награду — он показан под названием, и его можно сразу надеть.
 */
export function LeagueUpScene() {
  const t = useT();
  const locale = useLocale();
  const userId = useGame((s) => s.player?.profile.id ?? null);
  const level = useGame((s) => s.player?.leagueLevel ?? null);
  const leagues = useGame((s) => s.config?.leagues ?? null);
  const equip = useCollection((s) => s.equip);
  const busy = useCollection((s) => s.busy);
  /** новая лига и с какой лиги поднялся (награды — за все пройденные) */
  const [shown, setShown] = useState<{ level: number; from: number } | null>(null);
  const known = useRef<number | null>(null);

  useEffect(() => {
    if (userId === null || level === null) return;
    if (known.current === null) {
      // первый расчёт после входа: показываем, если лига выросла, пока игрока не было
      const seen = readSeen(userId);
      known.current = Math.max(level, seen ?? level);
      if (seen !== null && level > seen) setShown({ level, from: seen });
      else if (seen === null) writeSeen(userId, level);
      return;
    }
    if (level > known.current) setShown({ level, from: known.current });
    known.current = Math.max(known.current, level);
  }, [userId, level]);

  const close = () => {
    if (userId !== null && shown !== null) writeSeen(userId, shown.level);
    setShown(null);
  };
  const rewards = shown ? rewardsBetween(shown.from, shown.level) : [];
  const wear = rewards[rewards.length - 1];
  const onWear = async () => {
    if (!wear) return;
    await equip(wear.id);
    close();
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

  const league = shown !== null ? leagues?.[shown.level] : undefined;
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
          {rewards.length > 0 && (
            <motion.div
              className="relative mt-5 flex w-full max-w-[340px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-left"
              initial={reduced ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
              animate={{ opacity: 1, transform: 'translate3d(0, 0px, 0)' }}
              transition={{ delay: 0.7 + league.name.length * 0.07, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              data-testid="league-up-reward"
            >
              <div className="flex shrink-0 -space-x-3">
                {rewards.map((r) => (
                  <HeroBust key={r.id} skinId={r.id} size={52} className="rounded-xl ring-2 ring-black/60" />
                ))}
              </div>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] font-black uppercase tracking-wide text-gold">
                  {t('leagueUp.reward')}
                </span>
                <span className="block truncate text-[15px] font-black" data-testid="league-up-reward-name">
                  {rewards.map((r) => r.name[locale]).join(', ')}
                </span>
              </span>
            </motion.div>
          )}
          <motion.div
            className="relative mt-8 flex w-full max-w-[340px] flex-col gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + league.name.length * 0.07 }}
          >
            {wear && (
              <Button
                block
                className="h-14 text-base"
                loading={busy === wear.id}
                onClick={() => void onWear()}
                data-testid="league-up-equip"
              >
                {t('leagueUp.equip')}
              </Button>
            )}
            <Button
              block
              variant={wear ? 'secondary' : undefined}
              className={wear ? 'h-12 text-base' : 'h-14 text-base'}
              onClick={close}
              data-testid="league-up-close"
            >
              {t('leagueUp.cool')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
