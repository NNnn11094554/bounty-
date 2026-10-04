import { useEffect, useState } from 'react';
import { onFrame } from '../game/frameLoop';
import { tapEngine } from '../game/tapEngine';
import { useLayerVisible } from './tabLayer';

/** Хватает ли «живого» баланса на цену; перерисовка — только когда ответ меняется. */
export function useAffordable(price: number | null): boolean {
  const [ok, setOk] = useState(() => price !== null && tapEngine.balanceNow() >= price);
  const layerVisible = useLayerVisible();
  useEffect(() => {
    if (price === null) {
      setOk(false);
      return;
    }
    let last: boolean | null = null;
    return onFrame(
      () => {
        const next = tapEngine.balanceNow() >= price;
        if (next !== last) {
          last = next;
          setOk(next);
        }
      },
      { active: layerVisible },
    );
  }, [price, layerVisible]);
  return ok;
}
