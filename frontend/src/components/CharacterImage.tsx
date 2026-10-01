import type { CSSProperties } from 'react';

interface Props {
  size?: number;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
}

/** Персонаж — готовая картинка без изменений: WebP с плотностями экрана и PNG-фолбэк. */
export function CharacterImage({ size, className, style, eager = true }: Props) {
  return (
    <picture>
      <source
        type="image/webp"
        srcSet="/assets/generated/character-512.webp 512w, /assets/generated/character-1024.webp 1024w"
        sizes={size ? `${size}px` : '70vw'}
      />
      <img
        src="/assets/generated/character-512.png"
        alt=""
        draggable={false}
        width={size}
        height={size}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
        style={{ objectFit: 'cover', objectPosition: '55% 45%', ...style }}
      />
    </picture>
  );
}
