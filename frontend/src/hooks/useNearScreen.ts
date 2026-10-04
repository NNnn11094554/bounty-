import { useEffect, useRef, useState } from 'react';

/**
 * Элемент подошёл к экрану (с запасом margin): до этого тяжёлое содержимое (картинки) не рендерится.
 * Родная ленивая загрузка браузера берёт запас 1250–2500 px — в сетке из 20 карточек это почти все сразу:
 * лишние мегабайты и декодирование при открытии экрана. Однажды показанное больше не прячется.
 */
export function useNearScreen<T extends Element>(margin = '300px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}
