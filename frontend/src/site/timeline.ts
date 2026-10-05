import { onFrame } from '../game/frameLoop';
import { SECTIONS } from './content';

/**
 * Время и положение на сайте. Страница — обычные секции; у каждой (кроме подвала) своя станция
 * в 3D-сцене. Прокрутка задаёт цель (в станциях: 0 — главная, 1 — история, …), камера плавно догоняет
 * её — один общий кадр для сцены и интерфейса (game/frameLoop).
 */
export const LAST_STATION = SECTIONS.length - 1;
/** доля перехода в начале и в конце, где камера ещё (уже) стоит на станции */
const HOLD = 0.14;
/**
 * Камера догоняет прокрутку пружиной с критическим затуханием: разгоняется и тормозит плавно, без рывка
 * в первый кадр и без перелёта. Собственная частота, рад/с: ~1 с до цели.
 */
const OMEGA = 4.4;
/** скорость камеры, станций/с (состояние пружины) */
let velocity = 0;

export interface View {
  /** куда ведёт прокрутка, в станциях */
  target: number;
  /** где камера сейчас */
  pos: number;
  /** скорость камеры, станций в секунду (со знаком) */
  speed: number;
  /** секунды с начала */
  time: number;
  dt: number;
  /** секунды с начала вступления; < 0 — сцена ещё грузится */
  intro: number;
  reduced: boolean;
}

export const view: View = {
  target: 0,
  pos: 0,
  speed: 0,
  time: 0,
  dt: 0,
  intro: -1,
  reduced:
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
};

type Tick = (v: View) => void;
const ticks = new Set<Tick>();

/** Подписка на кадр сайта: вызывается после обновления view (сначала камера, потом подписчики). */
export function onTick(cb: Tick): () => void {
  ticks.add(cb);
  return () => ticks.delete(cb);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Доля перехода между станциями (0…1 внутри отрезка) → доля пути камеры: у станций она стоит. */
export function travel(f: number): number {
  return smootherstep(clamp01((f - HOLD) / (1 - 2 * HOLD)));
}

/** Близость камеры к станции: 1 — стоит на ней, 0 — далеко (за полперехода). */
export function nearness(pos: number, index: number): number {
  return 1 - smoothstep(0.12, 0.5, Math.abs(pos - index));
}

/** Секунды вступления → доля 0…1 отрезка [start, start + duration]. */
export function introPhase(start: number, duration: number): number {
  if (view.intro < 0) return 0;
  if (view.reduced) return 1;
  return clamp01((view.intro - start) / duration);
}

/**
 * Где на странице камера стоит у станции: [a, b] — положения середины экрана (px от начала страницы).
 * Пока секция закрывает экран, камера стоит; пока граница секций проходит экран, камера летит к следующей.
 */
let holds: Array<[number, number]> = [];
let screen = 0;

/** Середина экрана (px от начала страницы) → положение на таймлайне, в станциях. */
export function stationAt(anchor: number, spans: ReadonlyArray<[number, number]> = holds): number {
  if (!spans.length) return 0;
  for (let i = 0; i < spans.length; i++) {
    const [a, b] = spans[i]!;
    if (anchor < a) {
      if (i === 0) return 0;
      const prev = spans[i - 1]![1];
      return i - 1 + clamp01((anchor - prev) / Math.max(1, a - prev));
    }
    if (anchor <= b) return i;
  }
  return spans.length - 1;
}

/** Отрезки стоянки по секциям: верх и высота секции, высота экрана. */
export function holdSpans(
  boxes: ReadonlyArray<{ top: number; height: number }>,
  vh: number,
): Array<[number, number]> {
  return boxes.map(({ top, height }) =>
    height >= vh ? [top + vh / 2, top + height - vh / 2] : [top + height / 2, top + height / 2],
  );
}

/**
 * Спокойный момент для тяжёлой разовой работы (загрузка текстуры в видеопамять): камера стоит и страницу
 * не прокручивают. Ожидающие отпускаются по одному за кадр; дольше maxWaitMs не ждём (при непрерывной
 * прокрутке текстура всё равно нужна).
 */
const calmWaiters: Array<() => void> = [];
let lastScrollAt = -Infinity;
export function calm(maxWaitMs = 1200): Promise<void> {
  return new Promise((resolve) => {
    const release = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => {
      const i = calmWaiters.indexOf(release);
      if (i >= 0) calmWaiters.splice(i, 1);
      resolve();
    }, maxWaitMs);
    calmWaiters.push(release);
  });
}

/** Прокрутка к станции (меню): страница плавно едет к секции, камера летит следом. */
export function flyTo(index: number): void {
  const span = holds[Math.min(LAST_STATION, Math.max(0, index))];
  if (!span) return;
  const top = index <= 0 ? 0 : Math.max(0, span[0] - screen / 2);
  window.scrollTo({ top, behavior: view.reduced ? 'instant' : 'smooth' });
}

/** Прокрутка → цель. Секции — элементы [data-station] внутри root. Возвращает отписку. */
export function startTimeline(root: HTMLElement): () => void {
  const measure = () => {
    const h = window.innerHeight;
    // адресная строка телефона меняет высоту на ~60–120 px — их не считаем
    if (!screen || Math.abs(h - screen) > 160) screen = h;
    const y = window.scrollY;
    const boxes = [...root.querySelectorAll<HTMLElement>('[data-station]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + y, height: r.height };
    });
    holds = holdSpans(boxes, screen);
    readScroll();
  };
  const readScroll = () => {
    view.target = Math.min(LAST_STATION, stationAt(window.scrollY + screen / 2));
  };

  measure();
  view.pos = view.target;
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  const onScroll = () => {
    lastScrollAt = performance.now();
    readScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  void document.fonts?.ready.then(measure);

  let last = 0;
  // камера и 3D-сцена — каждый кадр (hot): в покое общий цикл игры обновляется ~10 раз в секунду, для
  // счётчиков этого хватает, а прокрутка и переходы на 10 кадрах в секунду дёргаются
  const stop = onFrame(
    (now) => {
      const t = now / 1000;
      const raw = last ? t - last : 1 / 60;
      // шаг анимаций ограничен (после паузы вкладки ничего не прыгает), вступление — по настоящему времени:
      // на медленном устройстве оно не растягивается
      const dt = Math.min(0.05, raw);
      last = t;
      view.time += dt;
      view.dt = dt;
      if (view.intro >= 0) view.intro += Math.min(0.5, raw);
      const prev = view.pos;
      if (view.reduced) {
        view.pos = view.target;
      } else {
        const steps = Math.ceil(dt / (1 / 120));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          velocity += (OMEGA * OMEGA * (view.target - view.pos) - 2 * OMEGA * velocity) * h;
          view.pos += velocity * h;
        }
        if (Math.abs(view.target - view.pos) < 1e-4 && Math.abs(velocity) < 1e-3) {
          view.pos = view.target;
          velocity = 0;
        }
      }
      view.speed = (view.pos - prev) / dt;
      ticks.forEach((cb) => cb(view));
      if (calmWaiters.length && view.pos === view.target && now - lastScrollAt > 250) calmWaiters.shift()!();
    },
    { hot: true },
  );

  return () => {
    stop();
    observer.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', measure);
  };
}

/** Начать вступление (сцена загружена). */
export function beginIntro(): void {
  if (view.intro < 0) view.intro = 0;
}
