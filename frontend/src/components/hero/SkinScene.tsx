import { useMemo } from 'react';
import { isReducedMotion } from '../../animations';
import {
  liteDevice,
  skinArt,
  skinId,
  skinImage,
  skinStyle,
  skinVars,
  type AmbientKind,
} from '../../game/skins';

/** Сколько частиц атмосферы: обычное устройство / слабое (или упрощённые анимации — тогда без движения). */
const AMBIENT_COUNT: Record<AmbientKind, [number, number]> = {
  rain: [22, 9],
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

/**
 * Сцена скина: фон персонажа (его мир), медленное «дыхание» фона, свечение за персонажем в цвете скина и
 * лёгкие частицы атмосферы. Всё — CSS-анимации transform/opacity (GPU), без JS-циклов; на слабых
 * устройствах — без движения фона и с меньшим числом частиц, при упрощённых анимациях — статично.
 * Событий не принимает. Смена скина — новый ключ: сцена мягко проявляется.
 */
export function SkinScene({
  skinId: rawId,
  className = '',
  testId,
}: {
  skinId: string;
  className?: string;
  testId?: string;
}) {
  const id = skinId(rawId);
  const style = skinStyle(id);
  const art = skinArt(id);
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
      className={`skin-scene pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={skinVars(id)}
      data-scene-skin={id}
      data-ambient={style.ambient}
      data-lite={lite || reduced ? 'true' : 'false'}
      data-testid={testId}
      aria-hidden
    >
      <div
        className="scene-bg skin-img absolute inset-0"
        style={{
          ...skinImage(id, 'background'),
          // фон выравнивается по месту, где персонаж стоял в своём мире
          backgroundPosition: `${(art.anchor[0] * 100).toFixed(1)}% 72%`,
        }}
        data-skin-file="background"
      />
      <div className="scene-glow absolute" />
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
