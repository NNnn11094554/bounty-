/**
 * Все длительности и кривые анимаций в одном месте (§16 ТЗ).
 * reduced — упрощённые анимации (настройка игрока или prefers-reduced-motion).
 */
export const DURATION = {
  tapTilt: 150,
  tapFloat: 800,
  tapRing: 350,
  balanceRoll: 380,
  balanceGlow: 600,
  tabSwitch: 250,
  /** появление вкладки: только прозрачность, быстро — вкладки переключают десятки раз за игру */
  tabFade: 150,
  /** экран поверх вкладки въезжает справа и уезжает обратно */
  screenIn: 300,
  screenOut: 240,
  sheet: 320,
  stagger: 40,
  coinFlight: 700,
} as const;

/** сколько первых элементов списка появляются по очереди (остальные ниже экрана — сразу) */
export const STAGGER_MAX = 8;

export const EASING = {
  /** сильный ease-out для появления и исчезновения (то же, что --ease-out в CSS) */
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  /** кривая выезжающих панелей в духе iOS (--ease-drawer) */
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
  /** пружинистый возврат с лёгким перелётом */
  springOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smoothOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  roll: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const SPRING = {
  button: { type: 'spring', stiffness: 600, damping: 22 },
  sheet: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 },
  tab: { type: 'spring', stiffness: 500, damping: 38 },
  pop: { type: 'spring', stiffness: 420, damping: 16 },
} as const;

let reduced =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export function setReducedMotion(value: boolean): void {
  reduced =
    value ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  // для CSS: живые анимации кота и частиц выключаются одним атрибутом
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
}

export function isReducedMotion(): boolean {
  return reduced;
}
