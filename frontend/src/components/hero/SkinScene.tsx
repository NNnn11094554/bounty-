import { useEffect, useMemo, useRef, useState } from 'react';
import { isReducedMotion } from '../../animations';
import {
  liteDevice,
  sceneRect,
  skinId,
  skinImage,
  skinStyle,
  skinVars,
  type AmbientKind,
  type Rect,
} from '../../game/skins';

/** Сколько частиц атмосферы: обычное устройство / слабое (или упрощённые анимации — тогда без движения). */
const AMBIENT_COUNT: Record<AmbientKind, [number, number]> = {
  neon: [14, 6],
  snow: [20, 8],
  petals: [14, 6],
  embers: [16, 7],
  stars: [18, 8],
  bubbles: [12, 5],
  fireflies: [12, 6],
  sparks: [14, 6],
  sand: [16, 7],
  spores: [12, 5],
  feathers: [9, 4],
  shards: [10, 4],
  bats: [4, 2],
  smoke: [6, 3],
  magic: [14, 6],
};

/** Детерминированный «случайный» разброс: одна и та же сцена выглядит одинаково при каждом показе. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Размер элемента (ResizeObserver): сцена подстраивается под свою область. */
function useSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * Сцена скина: мир персонажа (фон стоит так, что персонаж — fit, его рамка на экране — оказывается точно на
 * своём месте и закрывает его на картинке), свечение за персонажем в цвете скина и лёгкие частицы
 * атмосферы. Фон неподвижен (иначе съехал бы относительно персонажа); движутся только частицы и свет —
 * CSS-анимации transform/opacity (GPU), без JS-циклов; на слабых устройствах частиц меньше, при упрощённых
 * анимациях — статично. Событий не принимает. Смена скина — новый ключ: сцена мягко проявляется.
 */
export function SkinScene({
  skinId: rawId,
  fit,
  className = '',
  testId,
}: {
  skinId: string;
  /** рамка персонажа в координатах сцены (px) */
  fit: Rect | null;
  className?: string;
  testId?: string;
}) {
  const id = skinId(rawId);
  const style = skinStyle(id);
  const rootRef = useRef<HTMLDivElement>(null);
  const box = useSize(rootRef);
  const bg = fit && box.width > 0 ? sceneRect(id, fit, box) : null;
  const lite = liteDevice();
  const reduced = isReducedMotion();
  const particles = useMemo(() => {
    const [full, few] = AMBIENT_COUNT[style.ambient];
    const n = reduced ? Math.min(few, 5) : lite ? few : full;
    return Array.from({ length: n }, (_, i) => ({
      left: `${(rnd(i, 1) * 100).toFixed(1)}%`,
      top: `${(rnd(i, 2) * 100).toFixed(1)}%`,
      size: 0.6 + rnd(i, 3) * 0.8,
      duration: 0.6 + rnd(i, 4) * 0.8,
      delay: -rnd(i, 5),
      drift: rnd(i, 6) * 2 - 1,
    }));
  }, [style.ambient, lite, reduced]);

  return (
    <div
      ref={rootRef}
      className={`skin-scene pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={skinVars(id)}
      data-scene-skin={id}
      data-ambient={style.ambient}
      data-lite={lite || reduced ? 'true' : 'false'}
      data-testid={testId}
      aria-hidden
    >
      {bg && (
        <div
          className="scene-bg skin-img absolute"
          style={{
            ...skinImage(id, 'background', bg.width),
            left: bg.left,
            top: bg.top,
            width: bg.width,
            height: bg.height,
          }}
          data-skin-file="background"
        />
      )}
      {fit && (
        <div
          className="scene-glow absolute"
          style={{
            left: fit.left - fit.width * 0.35,
            top: fit.top + fit.height * 0.05,
            width: fit.width * 1.7,
            height: fit.height * 0.85,
          }}
        />
      )}
      <div className={`scene-amb amb-${style.ambient} absolute inset-0`}>
        {particles.map((p, i) => (
          <span
            key={i}
            className="amb absolute"
            style={{
              left: p.left,
              top: p.top,
              ['--s' as string]: p.size.toFixed(2),
              ['--k' as string]: p.duration.toFixed(2),
              ['--dx' as string]: p.drift.toFixed(2),
              animationDelay: `calc(var(--base) * ${p.delay.toFixed(2)})`,
            }}
          />
        ))}
      </div>
      <div className="scene-shade absolute inset-0" />
    </div>
  );
}
