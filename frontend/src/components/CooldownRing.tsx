import { formatDuration } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { tapEngine } from '../game/tapEngine';
import { useNow } from '../hooks/useNow';
import { useT } from '../i18n';

interface Props {
  /** конец кулдауна, серверное время (мс) */
  until: number;
  totalSec: number;
  size: number;
  /** показывать время текстом внутри кольца */
  showTime?: boolean;
}

/** Круговой таймер кулдауна поверх иконки: плавно убывает, по окончании — вспышка «Готово!». */
export function CooldownRing({ until, totalSec, size, showTime = true }: Props) {
  const t = useT();
  const now = useNow(1000);
  const left = Math.max(0, until - (now + (tapEngine.serverNow() - Date.now())));
  const [flash, setFlash] = useState(false);
  const wasRunning = useRef(left > 0);

  useEffect(() => {
    if (left > 0) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 1300);
    return () => window.clearTimeout(timer);
  }, [left]);

  const r = 45;
  const circumference = 2 * Math.PI * r;
  const ratio = totalSec > 0 ? Math.min(1, left / (totalSec * 1000)) : 0;

  return (
    <AnimatePresence>
      {left > 0 ? (
        <motion.div
          key="ring"
          className="pointer-events-none absolute inset-0 grid place-items-center"
          exit={{ opacity: 0, scale: 1.15 }}
          data-testid="cooldown"
        >
          <svg width={size} height={size} viewBox="0 0 100 100" className="absolute inset-0">
            <circle cx="50" cy="50" r="50" fill="rgba(20,16,31,0.62)" />
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#ffc93c"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          {showTime && (
            <span
              className="relative text-[11px] font-black tabular text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
              style={{ fontSize: Math.max(9, size / 5.2) }}
            >
              {formatDuration(left / 1000)}
            </span>
          )}
        </motion.div>
      ) : flash ? (
        <motion.div
          key="ready"
          className="pointer-events-none absolute inset-0 grid place-items-center"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1, 1] }}
          transition={{ duration: 1.3, times: [0, 0.25, 0.75, 1] }}
        >
          <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-black text-night-900 shadow-glow">
            {t('card.ready')}
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
