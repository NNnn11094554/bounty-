/**
 * Сдвиг кота влево, в долях его ширины: хвост слева, поэтому центр тела (без хвоста) — на 0,59 ширины
 * рамки. Сдвиг ставит центр тела ровно на середину сцены.
 */
const SHIFT_LEFT = 0.09;

/**
 * Раскладка сцены: кот в полный рост, ногами на нижний край, по центру сцены стоит тело кота (рамка
 * с хвостом — чуть левее). Зона тапа — вся высота сцены и ширина кота с запасом по
 * бокам (в полтора раза шире, но не шире сцены).
 */
export function heroLayout(width: number, height: number, aspect: number) {
  const catH = Math.min(height, (width * 0.8) / aspect);
  const catW = catH * aspect;
  const catLeft = Math.max(0, (width - catW) / 2 - catW * SHIFT_LEFT);
  const hitW = Math.min(width, catW * 1.5);
  const hitLeft = Math.min(width - hitW, Math.max(0, catLeft + (catW - hitW) / 2));
  return {
    cat: { left: catLeft, top: height - catH, width: catW, height: catH },
    hit: { left: hitLeft, width: hitW },
  };
}
