import { useEffect, useRef, type ReactNode } from 'react';
import { introPhase, onTick } from '../timeline';

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
      // плавная кривая без излома: панель проявляется и гаснет медленно в начале и в конце
      const k = 1 - Math.min(1, Math.max(0, (Math.abs(d) - 0.05) / 0.42));
      const near = k * k * k * (k * (k * 6 - 15) + 10);
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
      // лёгкий параллакс глубины: из глубины снизу, мимо зрителя вверх
      const y = (-d * 64).toFixed(1);
      const s = (1 + d * 0.05).toFixed(4);
      const key = `${p.toFixed(3)}|${y}|${s}`;
      if (key === last) return;
      last = key;
      el.style.setProperty('--p', p.toFixed(3));
      el.style.opacity = p.toFixed(3);
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
