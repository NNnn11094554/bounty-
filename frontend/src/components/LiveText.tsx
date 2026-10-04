import { useEffect, useRef } from 'react';
import { onFrame } from '../game/frameLoop';
import { useLayerVisible } from '../hooks/tabLayer';

interface Props {
  /** текст на текущий кадр; DOM меняется только при изменении */
  getText: () => string;
  className?: string;
  testId?: string;
}

/** Текст, обновляемый каждый кадр без перерисовки React (энергия, таймеры). */
export function LiveText({ getText, className, testId }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const getter = useRef(getText);
  getter.current = getText;
  const layerVisible = useLayerVisible();
  useEffect(() => {
    let last = '';
    return onFrame(
      () => {
        const text = getter.current();
        if (text !== last && ref.current) {
          ref.current.textContent = text;
          last = text;
        }
      },
      { active: layerVisible },
    );
  }, [layerVisible]);
  return <span ref={ref} className={className} data-testid={testId} />;
}
