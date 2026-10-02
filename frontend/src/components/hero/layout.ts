/**
 * Раскладка сцены: кот по центру в полный рост, ногами на нижний край. Зона тапа — вся высота сцены и
 * ширина кота с запасом по бокам (в полтора раза шире, но не шире сцены).
 */
export function heroLayout(width: number, height: number, aspect: number) {
  const catH = Math.min(height, (width * 0.8) / aspect);
  const catW = catH * aspect;
  const hitW = Math.min(width, catW * 1.5);
  return {
    cat: { left: (width - catW) / 2, top: height - catH, width: catW, height: catH },
    hit: { left: (width - hitW) / 2, width: hitW },
  };
}
