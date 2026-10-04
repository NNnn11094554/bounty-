import { useEffect, type CSSProperties } from 'react';

/** Задержка в очереди проявления: --k — номер элемента внутри секции. */
export const k = (n: number): CSSProperties => ({ ['--k' as string]: n });

/**
 * Проявление при прокрутке — одна система на весь сайт: элементы [data-rv] получают data-in, когда
 * входят в экран (один раз). Вид — по значению: up (снизу и из лёгкого размытия), scale, mask (слова
 * заголовка), line (линия рисуется). Очередь — --k. Только opacity, transform и filter.
 */
export function useReveal(root: () => HTMLElement | null): void {
  useEffect(() => {
    const host = root();
    if (!host) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    const watch = () => host.querySelectorAll('[data-rv]:not([data-in])').forEach((el) => io.observe(el));
    watch();
    // элементы, что появляются позже (карточка выбранного кота), — тоже
    const mo = new MutationObserver(watch);
    mo.observe(host, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [root]);
}
