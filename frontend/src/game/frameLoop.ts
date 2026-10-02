/**
 * Один общий requestAnimationFrame-цикл для всех «живых» чисел (баланс, энергия, прогресс).
 * Подписчики сами решают, менять ли DOM, — React при этом не перерисовывается.
 */
type FrameCallback = (now: number) => void;

const callbacks = new Set<FrameCallback>();
let rafId = 0;

function tick(now: number): void {
  callbacks.forEach((cb) => cb(now));
  rafId = callbacks.size ? requestAnimationFrame(tick) : 0;
}

export function onFrame(cb: FrameCallback): () => void {
  callbacks.add(cb);
  if (!rafId) rafId = requestAnimationFrame(tick);
  return () => {
    callbacks.delete(cb);
    if (!callbacks.size && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
