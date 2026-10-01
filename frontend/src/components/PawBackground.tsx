import { memo } from 'react';
import { PawIcon } from './icons';

const PAWS = [
  { x: 8, y: 12, s: 34, r: -20, d: 26, delay: 0 },
  { x: 78, y: 8, s: 26, r: 15, d: 31, delay: -6 },
  { x: 64, y: 36, s: 40, r: -8, d: 28, delay: -12 },
  { x: 14, y: 52, s: 28, r: 25, d: 34, delay: -3 },
  { x: 84, y: 62, s: 32, r: -30, d: 29, delay: -17 },
  { x: 36, y: 74, s: 24, r: 10, d: 33, delay: -9 },
  { x: 52, y: 90, s: 36, r: -12, d: 27, delay: -21 },
  { x: 24, y: 28, s: 22, r: 35, d: 36, delay: -14 },
];

/** Медленно плавающие отпечатки лап на фоне (opacity 0.04, только transform). */
export const PawBackground = memo(function PawBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {PAWS.map((p, i) => (
        <div
          key={i}
          className="paw-float absolute text-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: 0.04,
            animationDuration: `${p.d}s`,
            animationDelay: `${p.delay}s`,
            ['--r' as string]: `${p.r}deg`,
          }}
        >
          <PawIcon size={p.s} />
        </div>
      ))}
    </div>
  );
});
