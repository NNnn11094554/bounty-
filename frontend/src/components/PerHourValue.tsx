import { formatShort, formatSigned } from '@meowgul/shared';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { isReducedMotion } from '../animations';
import { useLocale, useT } from '../i18n';

interface Props {
  value: number;
  testId?: string;
}

/** Прибыль в час: при росте значение вспыхивает зелёным и взлетает «+3,93K/ч». */
export function PerHourValue({ value, testId }: Props) {
  const locale = useLocale();
  const t = useT();
  const prev = useRef(value);
  const [floats, setFloats] = useState<{ id: number; delta: number }[]>([]);
  const controls = useAnimationControls();

  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (delta <= 0) return;
    void controls.start({
      color: ['#4ade80', '#4ade80', '#ffffff'],
      scale: isReducedMotion() ? 1 : [1, 1.25, 1],
      transition: { duration: 0.9, times: [0, 0.35, 1] },
    });
    const id = Date.now() + Math.random();
    setFloats((list) => [...list, { id, delta }]);
    const timer = window.setTimeout(() => setFloats((list) => list.filter((f) => f.id !== id)), 1400);
    return () => window.clearTimeout(timer);
  }, [value, controls]);

  return (
    <span className="relative inline-flex">
      <motion.span animate={controls} data-testid={testId} className="inline-block">
        {formatSigned(value, locale)}
      </motion.span>
      <AnimatePresence>
        {floats.map((f) => (
          <motion.span
            key={f.id}
            className="pointer-events-none absolute -top-1 left-1/2 whitespace-nowrap text-sm font-black text-lime [text-shadow:0_1px_0_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, y: 0, x: '-50%' }}
            animate={{ opacity: [0, 1, 1, 0], y: -34, x: '-50%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
            data-testid="per-hour-float"
          >
            {t('card.perHourDelta', { value: `+${formatShort(f.delta, locale)}` })}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
