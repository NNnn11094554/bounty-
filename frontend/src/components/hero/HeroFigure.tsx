import type { CSSProperties } from 'react';
import {
  skinArt,
  skinAsset,
  skinIcon,
  skinId,
  skinImage,
  skinRarity,
  skinStyle,
  skinVars,
  type SkinFile,
} from '../../game/skins';

/**
 * Картинка скина через <picture>: AVIF, если браузер умеет, иначе WebP. Картинка не принимает событий и не
 * перетаскивается: долгое нажатие не открывает меню «Сохранить/Открыть».
 */
export function SkinPicture({
  skinId: id,
  file,
  className = '',
  eager = false,
  alt = '',
  style,
}: {
  skinId: string;
  file: SkinFile;
  className?: string;
  /** сразу (главный экран, открытое окно) или лениво (сетка коллекции) */
  eager?: boolean;
  alt?: string;
  style?: CSSProperties;
}) {
  return (
    <picture className="contents">
      <source srcSet={skinAsset(id, file, 'avif')} type="image/avif" />
      <img
        src={skinAsset(id, file, 'webp')}
        alt={alt}
        className={`pointer-events-none select-none ${className}`}
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        // React 18 не знает fetchPriority — атрибут в нижнем регистре, как в HTML
        {...({ fetchpriority: eager ? 'high' : 'auto' } as object)}
        data-skin-file={file}
        style={style}
      />
    </picture>
  );
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/**
 * Персонаж в полный рост — это и есть надетый скин. Слои (каждое движение — на своём элементе):
 *  - объём: медленный поворот в перспективе (transform ставит сцена) — смена позы в покое;
 *  - дыхание: бесшовный CSS-цикл от ступней (грудь поднимается, персонаж стоит на месте);
 *  - тело: картинка с «окном» под голову;
 *  - голова: та же картинка по эллипсу головы, чуть наклоняется вокруг шеи (CSS, data-pose от сцены);
 *  - глаза: радужка смещается внутри глаза (взгляд). Глаза не закрываются.
 * Тап персонажа не двигает: реагирует только взгляд и эффекты вокруг. Событий не принимает.
 */
export function HeroFigure({ skinId: rawId, height }: { skinId: string; height: number }) {
  const id = skinId(rawId);
  const art = skinArt(id);
  const style = skinStyle(id);
  const width = Math.round(height * art.aspect);
  const mask = `url(${skinAsset(id, 'character')})`;
  const img = skinImage(id, 'character');
  const { face } = art;
  const [hx, hy, hrx, hry] = face.head;
  // голова: непрозрачна до 82% эллипса и мягко сходит на нет к краю; в теле под ней «окно» до 74% —
  // в покое слои совпадают пиксель в пиксель, при наклоне край головы закрывает окно с запасом
  const headEllipse = `${pct(hrx)} ${pct(hry)} at ${pct(hx)} ${pct(hy)}`;
  const bodyMask = `radial-gradient(ellipse ${headEllipse}, transparent 66%, #000 76%)`;
  const headMask = `radial-gradient(ellipse ${headEllipse}, #000 80%, transparent 100%)`;
  const neck = `${pct(face.neck[0])} ${pct(face.neck[1])}`;
  const layer = (extra: CSSProperties): CSSProperties => ({ ...img, ...extra });
  return (
    <div
      className={`hero-fig pointer-events-none relative rarity-${skinRarity(id).toLowerCase()}`}
      style={{ width, height, ...skinVars(id) }}
      data-figure-skin={id}
      data-idle={style.idle}
    >
      <div className="hero-aura absolute" style={{ left: `${art.body * 100 - 75}%` }} />
      <div className="hero-floor absolute" style={{ left: `${art.body * 100 - 42}%` }} />
      <div className="hero-orbit absolute inset-0" style={{ transformOrigin: `${art.body * 100}% 100%` }}>
        <div
          className={`hero-idle idle-${style.idle} absolute inset-0`}
          style={{ transformOrigin: `${art.body * 100}% 100%` }}
        >
          {/* слой реакции оставлен неподвижным: тап не двигает персонажа (проверяют e2e) */}
          <div className="hero-react absolute inset-0" data-testid="hero-body">
            {/* фоном div, а не <img>: долгое нажатие не вызывает меню картинки */}
            <div
              className="hero-char skin-img absolute inset-0"
              style={layer({ maskImage: bodyMask, WebkitMaskImage: bodyMask })}
              data-skin-file="character"
            />
            <div
              className="hero-head absolute inset-0"
              style={{ transformOrigin: neck }}
              data-testid="hero-head"
            >
              <div
                className="hero-char skin-img absolute inset-0"
                style={layer({ maskImage: headMask, WebkitMaskImage: headMask })}
              />
              {face.eyes.map(([ex, ey, erx, ery], i) => {
                // окошко по глазу (чуть меньше самого глаза) — неподвижно; внутри — та же картинка персонажа,
                // её сдвигает transform (взгляд): радужка смещается внутри глаза
                const k = 0.92;
                const left = (ex - erx * k) * width;
                const top = (ey - ery * k) * height;
                return (
                  <div
                    key={i}
                    className="eye-iris absolute overflow-hidden"
                    style={{ left, top, width: erx * 2 * k * width, height: ery * 2 * k * height }}
                    data-testid="hero-eye"
                    data-reach={(Math.min(erx * width, ery * height) * 0.2).toFixed(2)}
                  >
                    <div
                      className="eye-iris-img skin-img absolute"
                      style={layer({
                        left: -left,
                        top: -top,
                        width,
                        height,
                        backgroundSize: '100% 100%',
                      })}
                    />
                  </div>
                );
              })}
            </div>
            {/* свет и тень строго по силуэту: маска — сама картинка персонажа */}
            <div
              className="hero-shade absolute inset-0"
              style={{ maskImage: mask, WebkitMaskImage: mask }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Портрет надетого скина в квадрате (аватар в профиле и т.п.). */
export function HeroBust({
  skinId: id,
  size,
  className = '',
}: {
  skinId: string;
  size: number;
  className?: string;
}) {
  return (
    <img
      src={skinIcon(id)}
      alt=""
      width={size}
      height={size}
      className={`hero-bust pointer-events-none object-cover ${className}`}
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size, ...skinVars(id) }}
      data-testid="hero-bust"
    />
  );
}
