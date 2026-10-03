/**
 * Раскладка сцены: персонаж в полный рост, ногами на нижний край, по центру сцены — вертикаль его тела
 * (body — доля ширины картинки: у персонажа с хвостом, крыльями или оружием сбоку рамка шире тела).
 * Зона тапа — вся высота сцены и ширина персонажа с запасом по бокам (в полтора раза шире, но не шире
 * сцены и не уже 60% её ширины — палец попадает и по узкому персонажу).
 */
export function heroLayout(width: number, height: number, aspect: number, body = 0.5) {
  const catH = Math.min(height, (width * 0.86) / aspect);
  const catW = catH * aspect;
  const catLeft = Math.min(width - catW, Math.max(0, width / 2 - catW * body));
  const hitW = Math.min(width, Math.max(catW * 1.5, width * 0.6));
  const hitLeft = Math.min(width - hitW, Math.max(0, catLeft + catW * body - hitW / 2));
  return {
    cat: { left: catLeft, top: height - catH, width: catW, height: catH },
    hit: { left: hitLeft, width: hitW },
  };
}
