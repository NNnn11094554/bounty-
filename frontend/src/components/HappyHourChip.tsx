import { formatDuration } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { tapEngine } from '../game/tapEngine';
import { useNow } from '../hooks/useNow';
import { useT } from '../i18n';
import { useGame } from '../store/game';

/** «Счастливый час ×2 · 42:10» — пока идёт счастливый час. */
export function HappyHourChip() {
  const t = useT();
  const hh = useGame((s) => s.player?.events.happyHour ?? null);
  useNow(1000, Boolean(hh));
  if (!hh) return null;
  const now = tapEngine.serverNow();
  if (now < hh.startsAt || now >= hh.endsAt) return null;
  const left = Math.ceil((hh.endsAt - now) / 1000);
  // центрирует внешний блок: transform внутреннего занят анимацией
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-lime/40 bg-gradient-to-r from-[#15924a]/90 to-[#c08a00]/90 px-3 py-1 text-xs font-black shadow-[0_0_18px_rgba(74,222,128,0.45)]"
        data-testid="happy-hour"
      >
        <span>🍀 {t('event.happyHour', { x: hh.multiplier })}</span>
        <span className="tabular text-white/85">{formatDuration(left)}</span>
      </motion.div>
    </div>
  );
}
