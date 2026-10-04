/**
 * Один общий цикл для всех «живых» чисел (баланс, энергия, прогресс). Подписчики сами решают, менять ли DOM, —
 * React при этом не перерисовывается.
 *
 * Цикл не гоняет кадры впустую: каждый запрошенный кадр заставляет браузер заново считать стили анимаций,
 * слои и отрисовку, даже если ничего не изменилось, — на слабом телефоне это отнимало большую часть времени
 * и тормозило переходы. Поэтому:
 *  - цикл работает, только пока есть подписчик на видимом экране (скрытая вкладка его не держит);
 *  - в покое значения обновляются ~10 раз в секунду (пассивный доход и энергия меняются несколько раз в
 *    секунду), а после касания или награды — каждый кадр, чтобы тап сразу был виден в счётчике;
 *  - подписчик, которому нужна плавность (подсказка, следящая за прокруткой), держит цикл на каждом кадре.
 */
type FrameCallback = (now: number) => void;

interface FrameOptions {
  /** подписчик на видимом экране (hooks/tabLayer: useLayerVisible); по умолчанию — всегда */
  active?: () => boolean;
  /** нужен каждый кадр, а не ~10 раз в секунду */
  hot?: boolean;
}

interface Sub {
  cb: FrameCallback;
  active: () => boolean;
  hot: boolean;
}

/** интервал обновления в покое */
const IDLE_MS = 100;
/** сколько после касания или награды числа обновляются каждый кадр */
const HOT_MS = 1200;

const subs = new Set<Sub>();
let rafId = 0;
let timer = 0;
let hotUntil = 0;
let listening = false;
let lastTouchAt = -Infinity;

const always = () => true;

function tick(now: number): void {
  rafId = 0;
  let any = false;
  let hot = false;
  subs.forEach((s) => {
    if (!s.active()) return;
    any = true;
    if (s.hot) hot = true;
    s.cb(now);
  });
  if (!any) return;
  if (hot || performance.now() < hotUntil) rafId = requestAnimationFrame(tick);
  else
    timer = window.setTimeout(() => {
      timer = 0;
      rafId = requestAnimationFrame(tick);
    }, IDLE_MS);
}

function start(): void {
  if (rafId || timer) return;
  for (const s of subs) {
    if (s.active()) {
      rafId = requestAnimationFrame(tick);
      return;
    }
  }
}

/** Касание или награда: следующие ~1,2 с числа обновляются каждый кадр. */
export function kickFrames(): void {
  hotUntil = performance.now() + HOT_MS;
  if (timer) {
    // цикл ждал в покое — следующий кадр сразу
    window.clearTimeout(timer);
    timer = 0;
    rafId = requestAnimationFrame(tick);
  } else start();
}

/** Сколько миллисекунд игрок не касался экрана (фоновую работу — в паузах, а не во время тапов). */
export function msSinceTouch(): number {
  return performance.now() - lastTouchAt;
}

function onTouch(): void {
  lastTouchAt = performance.now();
  kickFrames();
}

/** Сменилась видимая вкладка: запустить цикл, если на ней есть подписчики. */
export function wakeFrames(): void {
  start();
}

export function onFrame(cb: FrameCallback, options: FrameOptions = {}): () => void {
  if (!listening && typeof window !== 'undefined') {
    // любое касание (тап по коту, кнопка с наградой) — счётчики откликаются в тот же кадр
    window.addEventListener('pointerdown', onTouch, { capture: true, passive: true });
    listening = true;
  }
  const sub: Sub = { cb, active: options.active ?? always, hot: options.hot ?? false };
  subs.add(sub);
  if (sub.hot) kickFrames();
  else start();
  return () => {
    subs.delete(sub);
    if (subs.size) return;
    if (rafId) cancelAnimationFrame(rafId);
    if (timer) window.clearTimeout(timer);
    rafId = 0;
    timer = 0;
  };
}
