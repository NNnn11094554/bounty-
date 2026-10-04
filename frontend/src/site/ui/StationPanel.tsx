import { useEffect, useRef, type ReactNode } from 'react';
import { introPhase, onTick, smoothstep } from '../timeline';

interface Props {
  index: number;
  className?: string;
  /** главная ждёт конца вступления (сцена проявляется первой) */
  afterIntro?: boolean;
  label: string;
  children: ReactNode;
}

/**
 * Интерфейс станции поверх сцены. Он двигается вместе с камерой: подходя к станции, панель выходит из
 * глубины (меньше, прозрачнее, ниже), уходя — пролетает мимо зрителя (крупнее, выше).
 * Стили пишутся напрямую в DOM каждый кадр и только когда меняются — React не перерисовывается.
 */
export function StationPanel({ index, className = '', afterIntro = false, label, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = '';
    let shown = false;
    return onTick((v) => {
      const d = v.pos - index;
      const near = 1 - smoothstep(0.06, 0.44, Math.abs(d));
      const p = near * (afterIntro ? introPhase(2.2, 1.0) : v.intro >= 0 || v.reduced ? 1 : 0);
      if (p < 0.004) {
        if (shown) {
          el.style.visibility = 'hidden';
          el.style.willChange = 'auto';
          el.setAttribute('aria-hidden', 'true');
          shown = false;
          last = '';
        }
        return;
      }
      if (!shown) {
        el.style.visibility = 'visible';
        el.style.willChange = 'transform, opacity';
        el.removeAttribute('aria-hidden');
        shown = true;
      }
      // только transform и opacity — их браузер анимирует на видеокарте, без перерисовки слоя
      const y = (-d * 90).toFixed(1);
      const s = (1 + d * 0.08).toFixed(4);
      const key = `${p.toFixed(3)}|${y}|${s}`;
      if (key === last) return;
      last = key;
      el.style.setProperty('--p', p.toFixed(3));
      el.style.opacity = Math.min(1, p * 1.6).toFixed(3);
      el.style.transform = `translate3d(0, ${y}px, 0) scale(${s})`;
      el.style.pointerEvents = 'none';
      el.dataset.active = p > 0.6 ? 'true' : 'false';
    });
  }, [index, afterIntro]);

  return (
    <section ref={ref} className={`station ${className}`} aria-label={label} aria-hidden="true">
      {children}
    </section>
  );
}
