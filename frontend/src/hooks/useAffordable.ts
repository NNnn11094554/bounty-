import { useEffect, useState } from 'react';
import { onFrame } from '../game/frameLoop';
import { tapEngine } from '../game/tapEngine';

/** Хватает ли «живого» баланса на цену; перерисовка — только когда ответ меняется. */
export function useAffordable(price: number | null): boolean {
  const [ok, setOk] = useState(() => price !== null && tapEngine.balanceNow() >= price);
  useEffect(() => {
    if (price === null) {
      setOk(false);
      return;
    }
    let last: boolean | null = null;
    return onFrame(() => {
      const next = tapEngine.balanceNow() >= price;
      if (next !== last) {
        last = next;
        setOk(next);
      }
    });
  }, [price]);
  return ok;
}
