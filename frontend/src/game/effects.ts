/** Шина визуальных эффектов: конфетти и монеты, летящие в баланс. Рисует их EffectsLayer. */

export interface Point {
  x: number;
  y: number;
}

export type EffectEvent =
  { kind: 'confetti'; origin?: Point; amount?: number } | { kind: 'coins'; from: Point; count?: number };

type Listener = (event: EffectEvent) => void;
const listeners = new Set<Listener>();

export function onEffect(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: EffectEvent): void {
  listeners.forEach((l) => l(event));
}

export function confetti(origin?: Point, amount?: number): void {
  emit({ kind: 'confetti', origin, amount });
}

/** Монеты вылетают из точки и по дуге летят в элемент [data-coin-target]. */
export function flyCoins(from: Point, count = 14): void {
  emit({ kind: 'coins', from, count });
}

export function centerOf(el: Element | null): Point {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
