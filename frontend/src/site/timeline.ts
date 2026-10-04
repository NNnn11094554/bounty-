import { onFrame } from '../game/frameLoop';
import { STATIONS } from './content';

/**
 * Время и положение на сайте. Прокрутка задаёт цель (в станциях: 0 — главная, 1 — игра, …), камера и
 * интерфейс плавно догоняют её — один общий кадр для сцены и всех панелей (game/frameLoop).
 */
export const LAST_STATION = STATIONS.length - 1;
/** сколько высот экрана прокрутки на один переход между станциями */
export const STEP_SCREENS = 1.5;
/** доля перехода в начале и в конце, где камера ещё (уже) стоит на станции */
const HOLD = 0.14;
/** насколько быстро камера догоняет прокрутку (1/с): ~0.6 с до цели */
const FOLLOW = 5.2;

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

/** Пикселей прокрутки на станцию: от высоты экрана при загрузке (адресная строка телефона не дёргает её). */
let stepPx = 0;
export function stationScroll(index: number): number {
  return index * stepPx;
}

let flight: { from: number; to: number; start: number; duration: number } | null = null;

/** Перелёт к станции (меню): камера летит своей кривой, прокрутка сразу ставится на место. */
export function flyTo(index: number): void {
  const to = Math.min(LAST_STATION, Math.max(0, index));
  const distance = Math.abs(to - view.pos);
  if (distance < 0.01) return;
  flight = view.reduced
    ? null
    : { from: view.pos, to, start: view.time, duration: Math.min(3.2, 1.1 + distance * 0.45) };
  window.scrollTo({ top: stationScroll(to), behavior: 'instant' });
  view.target = to;
  if (!flight) view.pos = to;
}

/** Прокрутка → цель; высота страницы — по числу станций. Возвращает отписку. */
export function startTimeline(spacer: HTMLElement): () => void {
  const layout = () => {
    const h = window.innerHeight;
    // адресная строка телефона меняет высоту на ~60–120 px — пересчитываем только заметные изменения
    const next = Math.round(h * STEP_SCREENS);
    if (stepPx && Math.abs(next - stepPx) < 160 * STEP_SCREENS) return;
    stepPx = next;
    spacer.style.height = `${stepPx * LAST_STATION + h}px`;
    spacer.style.setProperty('--step', `${stepPx}px`);
    readScroll();
  };
  const readScroll = () => {
    if (!stepPx) return;
    view.target = Math.min(LAST_STATION, Math.max(0, window.scrollY / stepPx));
  };
  // ручная прокрутка во время перелёта — перелёт уступает ей
  const cancelFlight = () => {
    flight = null;
  };

  layout();
  view.pos = view.target;
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('wheel', cancelFlight, { passive: true });
  window.addEventListener('touchstart', cancelFlight, { passive: true });

  let last = 0;
  const stop = onFrame((now) => {
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
    if (flight) {
      const k = clamp01((view.time - flight.start) / flight.duration);
      view.pos = flight.from + (flight.to - flight.from) * easeInOutCubic(k);
      if (k >= 1) flight = null;
    } else if (view.reduced) {
      view.pos = view.target;
    } else {
      view.pos += (view.target - view.pos) * (1 - Math.exp(-dt * FOLLOW));
      if (Math.abs(view.target - view.pos) < 1e-4) view.pos = view.target;
    }
    view.speed = (view.pos - prev) / dt;
    ticks.forEach((cb) => cb(view));
  });

  return () => {
    stop();
    window.removeEventListener('scroll', readScroll);
    window.removeEventListener('resize', layout);
    window.removeEventListener('wheel', cancelFlight);
    window.removeEventListener('touchstart', cancelFlight);
  };
}

/** Начать вступление (сцена загружена). */
export function beginIntro(): void {
  if (view.intro < 0) view.intro = 0;
}
