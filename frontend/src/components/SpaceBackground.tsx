import { memo, useEffect, useRef, useState } from 'react';
import { isReducedMotion } from '../animations';
import { renderSky, skyImageUrl } from '../lib/spaceSky';
import { PawIcon } from './icons';

/** Еле заметные лапки — «созвездия» среди звёзд. */
const PAWS = [
  { x: 8, y: 14, s: 30, r: -20, d: 26, delay: 0 },
  { x: 80, y: 30, s: 24, r: 15, d: 31, delay: -6 },
  { x: 18, y: 58, s: 26, r: 25, d: 34, delay: -3 },
  { x: 70, y: 84, s: 30, r: -12, d: 27, delay: -21 },
];

/** Мерцающие звёзды: позиция в %, размер в px, период и сдвиг мерцания (с); spikes — яркая звезда с лучами. */
const TWINKLES = [
  { x: 86, y: 9, s: 16, d: 4.2, delay: 0, spikes: true },
  { x: 91, y: 13, s: 11, d: 3.6, delay: -1.7, spikes: true },
  { x: 14, y: 27, s: 12, d: 4.8, delay: -2.4, spikes: true },
  { x: 72, y: 63, s: 10, d: 3.9, delay: -0.9, spikes: true },
  { x: 31, y: 82, s: 13, d: 4.5, delay: -3.1, spikes: true },
  { x: 34, y: 16, s: 2.5, d: 4.1, delay: -1.3, spikes: false },
  { x: 57, y: 7, s: 2, d: 3.6, delay: -2.1, spikes: false },
  { x: 6, y: 44, s: 2, d: 3.9, delay: -2.8, spikes: false },
  { x: 93, y: 41, s: 2.5, d: 3.3, delay: -1.6, spikes: false },
  { x: 46, y: 52, s: 2, d: 4.4, delay: -3.2, spikes: false },
  { x: 4, y: 71, s: 2.5, d: 4.2, delay: -2.5, spikes: false },
  { x: 62, y: 91, s: 2, d: 4.0, delay: -2.3, spikes: false },
];

/** Яркая звезда: ядро, ореол и четыре луча (как на фото звёздного неба). */
function SparkleStar({ size }: { size: number }) {
  return (
    <svg width={size * 2} height={size * 2} viewBox="-20 -20 40 40" style={{ margin: -size }} aria-hidden>
      <defs>
        <radialGradient id="sp-halo">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#cfe0ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8fb0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sp-ray-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sp-ray-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#cfe0ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle r="9" fill="url(#sp-halo)" />
      <rect x="-19" y="-0.6" width="38" height="1.2" fill="url(#sp-ray-h)" />
      <rect x="-0.6" y="-19" width="1.2" height="38" fill="url(#sp-ray-v)" />
      <circle r="1.8" fill="#ffffff" />
    </svg>
  );
}

/** запас по краям под дрейф и параллакс */
const MARGIN = 48;

/**
 * Небо рисуется на canvas один раз (и при смене размера экрана) — дальше только сдвиг слоя.
 * Та же картинка уходит в CSS-переменную --space-sky для экранов поверх вкладок.
 */
function SkyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let objectUrl: string | null = null;
    const draw = () => {
      if (disposed) return;
      // мягкой туманности хватает плотности 1,5 — вдвое меньше пикселей, чем при 3
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      void renderSky(canvas, window.innerWidth + MARGIN * 2, window.innerHeight + MARGIN * 2, dpr)
        .then(() => (disposed ? null : skyImageUrl(canvas)))
        .then((url) => {
          if (!url || disposed) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = url;
          document.documentElement.style.setProperty('--space-sky', `url(${url})`);
        });
    };
    // рисуем, когда браузер свободен: первая отрисовка игры не ждёт неба
    const idle = (fn: () => void) =>
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(fn, { timeout: 1500 })
        : window.setTimeout(fn, 300);
    idle(draw);
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);
  return <canvas ref={ref} className="absolute" style={{ left: -MARGIN, top: -MARGIN }} />;
}

/** Падающая звезда раз в 6–14 секунд в случайном месте верхней части неба. */
function ShootingStars() {
  const [shot, setShot] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    let timer = 0;
    let id = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          if (document.visibilityState === 'visible') {
            setShot({ id: ++id, x: 15 + Math.random() * 75, y: 2 + Math.random() * 35 });
          }
          schedule();
        },
        6000 + Math.random() * 8000,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  if (!shot) return null;
  return <span key={shot.id} className="shooting-star" style={{ left: `${shot.x}%`, top: `${shot.y}%` }} />;
}

/**
 * Космический фон игры: ночное небо с туманностью (дрейфует и чуть смещается от наклона телефона),
 * мерцающие яркие звёзды с лучами, редкие падающие звёзды и еле заметные лапки.
 * Только transform и opacity; в режиме упрощённых анимаций фон неподвижен.
 */
export const SpaceBackground = memo(function SpaceBackground() {
  const reduced = isReducedMotion();
  const near = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);

  // параллакс от гироскопа: ближний слой смещается сильнее дальнего
  useEffect(() => {
    if (reduced || typeof window.DeviceOrientationEvent === 'undefined') return;
    let frame = 0;
    let gx = 0;
    let gy = 0;
    const apply = () => {
      frame = 0;
      if (far.current) far.current.style.transform = `translate3d(${gx * 6}px, ${gy * 6}px, 0)`;
      if (near.current) near.current.style.transform = `translate3d(${gx * 14}px, ${gy * 14}px, 0)`;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      gx = Math.max(-1, Math.min(1, e.gamma / 30));
      gy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('deviceorientation', onTilt);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div
      className="bg-space pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
      data-testid="space-bg"
    >
      <div ref={far} className="absolute inset-0">
        <div className={`absolute inset-0 ${reduced ? '' : 'space-drift'}`}>
          <SkyCanvas />
        </div>
      </div>
      <div ref={near} className="absolute inset-0">
        {TWINKLES.map((s, i) =>
          s.spikes ? (
            <span
              key={i}
              className={`absolute ${reduced ? 'opacity-80' : 'twinkle'}`}
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                animationDuration: `${s.d}s`,
                animationDelay: `${s.delay}s`,
              }}
            >
              <SparkleStar size={s.s} />
            </span>
          ) : (
            <span
              key={i}
              className={`absolute rounded-full bg-[#dfe8ff] ${reduced ? 'opacity-60' : 'twinkle'}`}
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.s,
                height: s.s,
                boxShadow: `0 0 ${s.s * 3}px ${s.s / 2}px rgba(190,210,255,0.45)`,
                animationDuration: `${s.d}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ),
        )}
        {PAWS.map((p, i) => (
          <div
            key={i}
            className={`absolute text-[#9fb6ff] ${reduced ? '' : 'paw-float'}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: 0.04,
              animationDuration: `${p.d}s`,
              animationDelay: `${p.delay}s`,
              ['--r' as string]: `${p.r}deg`,
            }}
          >
            <PawIcon size={p.s} />
          </div>
        ))}
        {!reduced && <ShootingStars />}
      </div>
    </div>
  );
});
