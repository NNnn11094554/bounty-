import { memo, useEffect, useRef } from 'react';
import { renderSky, skyImageUrl } from '../lib/spaceSky';

/** Яркие звёзды поверх неба: позиция в %, размер в px; spikes — звезда с лучами. */
const STARS = [
  { x: 86, y: 9, s: 16, spikes: true },
  { x: 91, y: 13, s: 11, spikes: true },
  { x: 14, y: 27, s: 12, spikes: true },
  { x: 72, y: 63, s: 10, spikes: true },
  { x: 31, y: 82, s: 13, spikes: true },
  { x: 34, y: 16, s: 2.5, spikes: false },
  { x: 57, y: 7, s: 2, spikes: false },
  { x: 6, y: 44, s: 2, spikes: false },
  { x: 93, y: 41, s: 2.5, spikes: false },
  { x: 46, y: 52, s: 2, spikes: false },
  { x: 4, y: 71, s: 2.5, spikes: false },
  { x: 62, y: 91, s: 2, spikes: false },
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

/**
 * Небо рисуется на canvas один раз (и при смене размера экрана).
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
      void renderSky(canvas, window.innerWidth, window.innerHeight, dpr)
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
  return <canvas ref={ref} className="absolute left-0 top-0" />;
}

/**
 * Космический фон игры: ночное небо с туманностью и яркие звёзды с лучами — неподвижные. Фон виден на
 * каждом экране всё время, поэтому он не анимируется и не следит за гироскопом: рисуется один раз и больше
 * не стоит телефону ничего (ни кадров, ни событий датчика).
 */
export const SpaceBackground = memo(function SpaceBackground() {
  return (
    <div
      className="bg-space pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
      data-testid="space-bg"
    >
      <SkyCanvas />
      {STARS.map((s, i) =>
        s.spikes ? (
          <span key={i} className="absolute opacity-90" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <SparkleStar size={s.s} />
          </span>
        ) : (
          <span
            key={i}
            className="absolute rounded-full bg-[#dfe8ff] opacity-70"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              boxShadow: `0 0 ${s.s * 3}px ${s.s / 2}px rgba(190,210,255,0.45)`,
            }}
          />
        ),
      )}
    </div>
  );
});
