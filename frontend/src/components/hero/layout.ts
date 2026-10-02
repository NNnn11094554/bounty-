import { HERO } from '../../game/skins';

/** Раскладка сцены: кот слева в полный рост, кнопка TAP справа на уровне рук. */
export function heroLayout(width: number, height: number) {
  const gap = Math.round(width * 0.02);
  let tap = Math.round(Math.min(190, Math.max(108, width * 0.4)));
  let catH = Math.min(height, (width - tap - gap) / HERO.aspect);
  tap = Math.min(tap, Math.round(catH * 0.56));
  catH = Math.min(height, (width - tap - gap) / HERO.aspect);
  const catW = catH * HERO.aspect;
  const left = (width - (catW + gap + tap)) / 2;
  const tapH = tap / HERO.tapAspect;
  return {
    cat: { left, top: height - catH, width: catW, height: catH },
    tap: { left: left + catW + gap, top: height - catH + catH * 0.6 - tapH / 2, width: tap, height: tapH },
  };
}
