import { useEffect, useRef } from 'react';
import { nearness, onTick } from '../timeline';

/** Число плавно набирается от нуля, когда камера подходит к станции (и сбрасывается, когда уходит). */
export function CountUp({ to, station }: { to: number; station: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let shown = -1;
    let t = 0;
    return onTick((v) => {
      const near = nearness(v.pos, station);
      t = near > 0.6 ? Math.min(1, t + v.dt / 1.2) : near < 0.05 ? 0 : t;
      const e = 1 - (1 - t) ** 3;
      const value = v.reduced ? to : Math.round(to * e);
      if (value !== shown && ref.current) {
        ref.current.textContent = String(value);
        shown = value;
      }
    });
  }, [to, station]);
  return (
    <span ref={ref} className="tabular">
      {to}
    </span>
  );
}
