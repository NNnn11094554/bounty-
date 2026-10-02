import { useId, type Ref } from 'react';
import { heroAsset, skinRarity, skinRig, skinStyle, skinVars } from '../../game/skins';

export interface HeroRefs {
  /** реакция корпуса на тап (сжатие, наклон) — ведёт физика CatMotion */
  body?: Ref<HTMLDivElement>;
  /** голова: взгляд, кивок */
  head?: Ref<HTMLDivElement>;
  /** взмах хвоста поверх его спокойного покачивания */
  tail?: Ref<HTMLDivElement>;
  /** подёргивание уха */
  ear?: Ref<HTMLDivElement>;
  /** притоп кроссовкой */
  foot?: Ref<HTMLDivElement>;
  /** веки (моргание, прищур, сон) */
  lids?: Ref<SVGSVGElement>;
}

const PARTICLES: Record<string, number> = { COMMON: 0, RARE: 4, EPIC: 5, LEGENDARY: 7, MYTHIC: 9 };

/**
 * Кот в полный рост из слоёв по его скелету (rig): хвост, кроссовка и голова — под телом, их стык спрятан
 * под одеждой и наушниками; ухо — под головой. Слои вложены так, что каждое движение живёт на своём элементе и не спорит с
 * другими: поза (медленно) → дыхание → реакция на тап (физика) → голова/хвост (свои покачивания + физика).
 * Слои — div с фоном, а не <img>: долгое нажатие не вызывает меню картинки. Событий не принимает.
 */
export function HeroFigure({ skinId, height, refs }: { skinId: string; height: number; refs?: HeroRefs }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rig = skinRig(skinId);
  const width = Math.round(height * rig.aspect);
  const rarity = skinRarity(skinId);
  const particle = skinStyle(skinId).particle;
  const count = particle ? (PARTICLES[rarity] ?? 0) : 0;
  const layer = (part: 'body' | 'head' | 'ear' | 'tail' | 'foot') => ({
    backgroundImage: `url(${heroAsset(skinId, part)})`,
  });
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
                animationDuration: `${(3.6 + (i % 3) * 0.8).toFixed(1)}s`,
              }}
            >
              {particle === 'code' ? (i % 2 ? '1' : '0') : null}
            </span>
          ))}
        </div>
      )}
      <div className="hero-pose absolute inset-0">
        <div className="hero-breath absolute inset-0">
          <div ref={refs?.body} className="hero-react absolute inset-0">
            <div
              ref={refs?.tail}
              className="hero-part absolute inset-0"
              style={{ transformOrigin: rig.tailOrigin }}
            >
              <div
                className="hero-tail hero-layer absolute inset-0"
                style={{ ...layer('tail'), transformOrigin: rig.tailOrigin }}
              />
            </div>
            <div
              ref={refs?.foot}
              className="hero-part absolute inset-0"
              style={{ transformOrigin: rig.footOrigin }}
            >
              <div className="hero-layer absolute inset-0" style={layer('foot')} />
            </div>
            <div
              ref={refs?.head}
              className="hero-part absolute inset-0"
              style={{ transformOrigin: rig.headOrigin }}
            >
              <div className="hero-head absolute inset-0" style={{ transformOrigin: rig.headOrigin }}>
                <div
                  ref={refs?.ear}
                  className="hero-part absolute inset-0"
                  style={{ transformOrigin: rig.earOrigin }}
                >
                  <div className="hero-layer absolute inset-0" style={layer('ear')} data-testid="hero-ear" />
                </div>
                <div className="hero-layer absolute inset-0" style={layer('head')} data-testid="hero-head" />
                <svg
                  ref={refs?.lids}
                  className="absolute inset-0 h-full w-full"
                  viewBox={rig.viewBox}
                  aria-hidden
                >
                  {rig.eyes.map((e, i) => (
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
              </div>
            </div>
            <div className="hero-layer absolute inset-0" style={layer('body')} data-testid="hero-body" />
            {rig.leds.map((l, i) => (
              <span
                key={i}
                className="hero-led absolute"
                style={{
                  left: l.left,
                  top: l.top,
                  width: l.size,
                  animationDelay: `${(-i * 0.9).toFixed(2)}s`,
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
      style={{ width: Math.round(height * skinRig(skinId).aspect), height, ...skinVars(skinId) }}
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
