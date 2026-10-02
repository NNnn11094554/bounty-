const VARIANTS = [256, 512, 1024] as const;

/** Файл персонажа под размер и плотность экрана (WebP; все WebView Telegram его поддерживают). */
export function characterUrl(size = 512): string {
  const px = size * Math.min(3, typeof window === 'undefined' ? 2 : window.devicePixelRatio || 1);
  const variant = VARIANTS.find((v) => v >= px) ?? 1024;
  return `/assets/generated/character-${variant}.webp`;
}
