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
/** с какой длины строки («100 000 000» — 11 знаков) число может не поместиться и стоит его мерить */
const FIT_FROM_CHARS = 12;

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
    /** когда разряд менялся в последний раз (мс) */
    const changedAt: number[] = [];
    const rollTransition = () =>
      isReducedMotion() ? 'none' : `transform ${DURATION.balanceRoll}ms ${EASING.roll}`;

    const build = (text: string) => {
      root.textContent = '';
      columns.length = 0;
      changedAt.length = 0;
      for (const ch of text) {
        if (DIGITS.includes(ch)) {
          const cell = document.createElement('span');
          cell.className = 'roll-cell';
          const col = document.createElement('span');
          col.className = 'roll-col';
          col.style.transition = rollTransition();
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

    // очень большое число (поздняя игра — сотни триллионов) не помещается в строку с монеткой на узком
    // экране: шрифт уменьшается ровно настолько, чтобы строка влезла. Проверка — только когда меняется
    // количество цифр (и при смене размера экрана), не на каждом кадре.
    const fit = () => {
      root.style.fontSize = '';
      // до сотен миллионов число заведомо помещается — без замера (замер пересчитывает раскладку экрана)
      if (shown.length < FIT_FROM_CHARS) return;
      const row = root.parentElement;
      if (!row) return;
      const cs = getComputedStyle(row);
      const items = Array.from(row.children) as HTMLElement[];
      // соседи (монетка) не сжимаются — уменьшается только число
      for (const el of items) if (el !== root) el.style.flexShrink = '0';
      const gap = parseFloat(cs.columnGap) || 0;
      const content =
        items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0) + gap * (items.length - 1);
      // запас по краям, чтобы число не упиралось в край экрана
      const room =
        row.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 24;
      const over = content - room;
      if (over <= 0) return;
      const width = root.getBoundingClientRect().width;
      const base = parseFloat(getComputedStyle(root).fontSize);
      if (width > 0) root.style.fontSize = `${Math.max(12, Math.floor((base * (width - over)) / width))}px`;
    };
    window.addEventListener('resize', fit);

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
        shown = text;
        fit();
      } else {
        const now = performance.now();
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]!;
          if (ch !== shown[i] && DIGITS.includes(ch)) {
            const col = columns[i]!;
            // разряд меняется чаще, чем длится прокрутка (пассивный доход капает несколько раз в секунду), —
            // он переключается сразу: иначе цифра всё время висит между двумя значениями и не читается
            const fast = now - (changedAt[i] ?? -Infinity) < DURATION.balanceRoll;
            const transition = fast ? 'none' : rollTransition();
            if (col.style.transition !== transition) col.style.transition = transition;
            col.style.transform = `translateY(-${Number(ch) * 10}%)`;
            changedAt[i] = now;
          }
        }
      }
      shown = text;
      root.setAttribute('aria-label', text);
    };
    render();
    const off = onFrame(render);
    return () => {
      off();
      window.removeEventListener('resize', fit);
    };
  }, [glowOnJump]);

  return <span ref={ref} className={`roll ${className}`} data-testid={testId} role="text" />;
}
