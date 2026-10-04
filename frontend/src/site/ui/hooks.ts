import { useEffect, useState } from 'react';
import { nearness, onTick } from '../timeline';

/** Номер станции, к которой ближе камера (меняется редко — для React). */
export function useActiveStation(): number {
  const [active, setActive] = useState(0);
  useEffect(
    () =>
      onTick((v) => {
        const i = Math.round(v.pos);
        setActive((prev) => (prev === i ? prev : i));
      }),
    [],
  );
  return active;
}

/** Камера стоит у станции (для слоёв ввода: тап в игре, свайп в коллекции). */
export function useAtStation(index: number, threshold = 0.7): boolean {
  const [at, setAt] = useState(false);
  useEffect(
    () =>
      onTick((v) => {
        const next = v.intro >= 0 && nearness(v.pos, index) > threshold;
        setAt((prev) => (prev === next ? prev : next));
      }),
    [index, threshold],
  );
  return at;
}
