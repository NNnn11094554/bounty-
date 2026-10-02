/** Раскладка сцены: кот по центру в полный рост, ногами на нижний край; сам кот — зона тапа. */
export function heroLayout(width: number, height: number, aspect: number) {
  const catH = Math.min(height, (width * 0.8) / aspect);
  const catW = catH * aspect;
  return { cat: { left: (width - catW) / 2, top: height - catH, width: catW, height: catH } };
}
