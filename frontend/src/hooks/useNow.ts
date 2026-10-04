import { useEffect, useState } from 'react';
import { useLayerShown } from './tabLayer';

/**
 * Текущее время для таймеров кулдаунов: компонент перерисовывается раз в intervalMs, а время берётся в момент
 * рендера. В скрытой вкладке (components/TabLayer) таймер стоит; при показе компонент сразу перерисовывается
 * с верным остатком.
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [, setTick] = useState(0);
  const shown = useLayerShown();
  useEffect(() => {
    if (!active || !shown) return;
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active, shown]);
  return Date.now();
}
