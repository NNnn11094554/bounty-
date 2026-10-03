import type { CSSProperties, Ref } from 'react';
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

/**
 * Персонаж в полный рост — это и есть надетый скин. Слои движения вложены так, что каждое живёт на своём
 * элементе и не спорит с другими: объём (поворот в перспективе, угол — CSS-переменные --yaw/--pitch от
 * сцены) → спокойная анимация скина (бесшовный CSS-цикл) → реакция на тап (физика из JS, ref body).
 * Все движения маленькие и от ступней: персонаж стоит на месте. Событий не принимает.
 */
export function HeroFigure({
  skinId: rawId,
  height,
  bodyRef,
}: {
  skinId: string;
  height: number;
  bodyRef?: Ref<HTMLDivElement>;
}) {
  const id = skinId(rawId);
  const art = skinArt(id);
  const style = skinStyle(id);
  const width = Math.round(height * art.aspect);
  const mask = `url(${skinAsset(id, 'character')})`;
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
          <div
            ref={bodyRef}
            className="hero-react absolute inset-0"
            style={{ transformOrigin: `${art.body * 100}% 100%` }}
            data-testid="hero-body"
          >
            {/* фоном div, а не <img>: долгое нажатие не вызывает меню картинки */}
            <div
              className="hero-char skin-img absolute inset-0"
              style={skinImage(id, 'character')}
              data-skin-file="character"
            />
            {/* свет и тень строго по силуэту: маска — сама картинка персонажа */}
            <div
              className="hero-shade absolute inset-0"
              style={{ maskImage: mask, WebkitMaskImage: mask }}
              aria-hidden
            >
              <div className="hero-shade-dark absolute" />
              <div className="hero-shade-light absolute" />
            </div>
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
