import { useId, type Ref } from 'react';
import { HERO, heroAsset, skinRarity, skinStyle, skinVars } from '../../game/skins';

export interface HeroRefs {
  /** наклон к пальцу (2.5D) */
  lean?: Ref<HTMLDivElement>;
  /** прыжок и сжатие от тапа, разворот */
  bounce?: Ref<HTMLDivElement>;
  /** взмах хвоста поверх его постоянного покачивания */
  tail?: Ref<HTMLDivElement>;
  /** веки (моргание, подмигивание, сон) */
  lids?: Ref<SVGSVGElement>;
}

const PARTICLES: Record<string, number> = { COMMON: 0, RARE: 4, EPIC: 5, LEGENDARY: 7, MYTHIC: 9 };

/**
 * Кот в полный рост из слоёв: аура → хвост (качается вокруг точки за штаниной) → тело → веки
 * (моргание) → огоньки на наушниках и кроссовках. Слои — div с фоном, а не <img>: долгое нажатие
 * не вызывает меню картинки. Событий не принимает. Анимации — transform/opacity (CSS и WAAPI).
 */
export function HeroFigure({ skinId, height, refs }: { skinId: string; height: number; refs?: HeroRefs }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const width = Math.round(height * HERO.aspect);
  const rarity = skinRarity(skinId);
  const particle = skinStyle(skinId).particle;
  const count = particle ? (PARTICLES[rarity] ?? 0) : 0;
  return (
    <div
      className={`hero-fig pointer-events-none relative rarity-${rarity.toLowerCase()}`}
      style={{ width, height, ...skinVars(skinId) }}
      data-figure-skin={skinId}
    >
      <div className="hero-aura absolute" />
      <div className="hero-floor absolute" />
      {count > 0 && (
        <div className="absolute inset-0" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={`hero-drift pt pt-${particle}`}
              style={{
                left: `${8 + ((i * 37) % 84)}%`,
                top: `${18 + ((i * 53) % 64)}%`,
                ['--pt' as string]: `${Math.round(Math.max(10, height * 0.04))}px`,
                animationDelay: `${(-i * 0.83).toFixed(2)}s`,
                animationDuration: `${(3.4 + (i % 3) * 0.7).toFixed(1)}s`,
              }}
            >
              {particle === 'code' ? (i % 2 ? '1' : '0') : null}
            </span>
          ))}
        </div>
      )}
      <div ref={refs?.lean} className="hero-lean absolute inset-0">
        <div className="hero-idle absolute inset-0">
          <div ref={refs?.bounce} className="hero-bounce absolute inset-0">
            <div
              ref={refs?.tail}
              className="hero-layer absolute inset-0"
              style={{ transformOrigin: HERO.tailOrigin }}
            >
              <div
                className="hero-tail hero-layer absolute inset-0"
                style={{
                  backgroundImage: `url(${heroAsset(skinId, 'tail')})`,
                  transformOrigin: HERO.tailOrigin,
                }}
              />
            </div>
            <div
              className="hero-body hero-layer absolute inset-0"
              style={{ backgroundImage: `url(${heroAsset(skinId, 'body')})` }}
              data-testid="hero-body"
            />
            <svg
              ref={refs?.lids}
              className="absolute inset-0 h-full w-full"
              viewBox={HERO.viewBox}
              aria-hidden
            >
              {HERO.eyes.map((e, i) => (
                <g key={i} transform={`rotate(${e.rot} ${e.cx} ${e.cy})`}>
                  <clipPath id={`eye${uid}${i}`}>
                    <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />
                  </clipPath>
                  <g clipPath={`url(#eye${uid}${i})`}>
                    <rect
                      className="hero-lid"
                      data-eye={i}
                      x={e.cx - e.rx - 3}
                      y={e.cy - e.ry - 3}
                      width={e.rx * 2 + 6}
                      height={e.ry * 2 + 6}
                    />
                  </g>
                  <path
                    className="hero-lash"
                    data-eye={i}
                    d={`M ${e.cx - e.rx * 0.92} ${e.cy + e.ry * 0.1} Q ${e.cx} ${e.cy + e.ry * 0.95} ${e.cx + e.rx * 0.92} ${e.cy + e.ry * 0.1}`}
                  />
                </g>
              ))}
            </svg>
            {HERO.leds.map((l, i) => (
              <span
                key={i}
                className="hero-led absolute"
                style={{
                  left: l.left,
                  top: l.top,
                  width: l.size,
                  animationDelay: `${(-i * 0.55).toFixed(2)}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Превью скина одной картинкой (кот целиком, без анимации слоёв) — для сеток и карточек. */
export function HeroThumb({
  skinId,
  height,
  className = '',
}: {
  skinId: string;
  height: number;
  className?: string;
}) {
  return (
    <div
      className={`hero-thumb pointer-events-none relative ${className}`}
      style={{ width: Math.round(height * HERO.aspect), height, ...skinVars(skinId) }}
    >
      <div className="hero-aura absolute" />
      <div
        className="hero-layer absolute inset-0"
        style={{ backgroundImage: `url(${heroAsset(skinId, 'thumb')})` }}
      />
    </div>
  );
}

/** Портрет: голова и плечи надетого скина в квадрате (аватар в профиле и т.п.). */
export function HeroBust({
  skinId,
  size,
  className = '',
}: {
  skinId: string;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`hero-bust pointer-events-none overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${heroAsset(skinId, 'thumb')})`,
        ...skinVars(skinId),
      }}
    />
  );
}

/** Кнопка TAP скина (без логики) — для превью в окне скина. */
export function TapPreview({ skinId, size }: { skinId: string; size: number }) {
  return (
    <div
      className="hero-layer pointer-events-none"
      style={{
        width: size,
        height: size / HERO.tapAspect,
        backgroundImage: `url(${heroAsset(skinId, 'tap')})`,
      }}
    />
  );
}
