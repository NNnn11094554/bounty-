import { formatInt } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../animations';
import { onFrame } from '../game/frameLoop';

interface Props {
  /** вызывается каждый кадр; целая часть показывается */
  getValue: () => number;
  className?: string;
  /** подсветка золотом при резком росте (награда) */
  glowOnJump?: boolean;
  testId?: string;
}

const DIGITS = '0123456789';

/** Число «как на табло»: каждая цифра прокручивается отдельно. Обновление — напрямую в DOM. */
export function RollingNumber({ getValue, className = '', glowOnJump = true, testId }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const getter = useRef(getValue);
  getter.current = getValue;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let shown = '';
    let lastValue = -1;
    const columns: HTMLSpanElement[] = [];

    const build = (text: string) => {
      root.textContent = '';
      columns.length = 0;
      for (const ch of text) {
        if (DIGITS.includes(ch)) {
          const cell = document.createElement('span');
          cell.className = 'roll-cell';
          const col = document.createElement('span');
          col.className = 'roll-col';
          col.style.transition = isReducedMotion()
            ? 'none'
            : `transform ${DURATION.balanceRoll}ms ${EASING.roll}`;
          col.style.transform = `translateY(-${Number(ch) * 10}%)`;
          for (const d of DIGITS) {
            const s = document.createElement('span');
            s.textContent = d;
            col.appendChild(s);
          }
          cell.appendChild(col);
          root.appendChild(cell);
          columns.push(col);
        } else {
          const sep = document.createElement('span');
          sep.className = 'roll-sep';
          sep.textContent = ch === ' ' ? ' ' : ch;
          root.appendChild(sep);
          columns.push(sep);
        }
      }
    };

    const render = () => {
      const value = Math.max(0, Math.floor(getter.current()));
      if (value === lastValue) return;
      const text = formatInt(value);
      if (
        glowOnJump &&
        lastValue >= 0 &&
        value - lastValue >= Math.max(1000, lastValue * 0.02) &&
        !isReducedMotion()
      ) {
        root.animate(
          [
            { transform: 'scale(1)', textShadow: '0 0 0 rgba(255,201,60,0)' },
            { transform: 'scale(1.08)', textShadow: '0 0 24px rgba(255,201,60,0.9)', offset: 0.35 },
            { transform: 'scale(1)', textShadow: '0 0 0 rgba(255,201,60,0)' },
          ],
          { duration: DURATION.balanceGlow, easing: EASING.smoothOut },
        );
      }
      lastValue = value;
      if (text.length !== shown.length) {
        build(text);
      } else {
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]!;
          if (ch !== shown[i] && DIGITS.includes(ch)) {
            columns[i]!.style.transform = `translateY(-${Number(ch) * 10}%)`;
          }
        }
      }
      shown = text;
      root.setAttribute('aria-label', text);
    };
    render();
    return onFrame(render);
  }, [glowOnJump]);

  return <span ref={ref} className={`roll ${className}`} data-testid={testId} role="text" />;
}
