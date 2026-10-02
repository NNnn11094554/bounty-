// Слои персонажа для анимации: хвост отдельно от тела.
// Хвост уходит за левую штанину; граница проведена по краю штанины, кармана и бирки рюкзака, поэтому
// при покачивании хвоста (он рисуется ПОД телом) стык спрятан под одеждой. Чтобы при повороте у стыка
// не открывалась щель, хвост продолжен под штаниной — эту часть закрывает тело.

/** контур хвоста в координатах исходной картинки 1254×1254 */
export const TAIL_POLYGON = [
  [0, 694],
  [196, 694],
  [200, 746],
  [258, 750],
  [258, 808],
  [300, 812],
  [305, 822],
  [295, 840],
  [276, 860],
  [264, 880],
  [256, 900],
  [250, 920],
  [244, 940],
  [232, 958],
  [220, 975],
  [212, 995],
  [205, 1014],
  [0, 1014],
];

/** точка, вокруг которой качается хвост (там, где он скрывается за штаниной) */
export const TAIL_PIVOT = [258, 892];

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * @param {Buffer} rgba — вырезанный персонаж, W×H
 * @returns {{ body: Buffer, tail: Buffer }} два слоя того же размера
 */
export function splitTail(rgba, W, H) {
  const body = Buffer.from(rgba);
  const tail = Buffer.alloc(rgba.length);
  const xs = TAIL_POLYGON.map((p) => p[0]);
  const ys = TAIL_POLYGON.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let y = y0; y <= y1 && y < H; y++) {
    for (let x = x0; x <= x1 && x < W; x++) {
      if (!inside(TAIL_POLYGON, x + 0.5, y + 0.5)) continue;
      const i = (y * W + x) * 4;
      rgba.copy(tail, i, i, i + 4);
      body[i + 3] = 0;
    }
  }
  // продолжение хвоста под одеждой: 18 шагов расширения в непрозрачные пиксели тела рядом с границей
  const ex0 = Math.max(0, x0);
  const ex1 = Math.min(W - 1, x1 + 30);
  const ey0 = Math.max(0, y0 - 20);
  const ey1 = Math.min(H - 1, y1 + 10);
  for (let step = 0; step < 18; step++) {
    const add = [];
    for (let y = ey0; y <= ey1; y++) {
      for (let x = ex0; x <= ex1; x++) {
        const i = (y * W + x) * 4;
        if (tail[i + 3] > 0 || body[i + 3] < 200) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = (ny * W + nx) * 4;
          if (tail[j + 3] > 200) {
            add.push([i, j]);
            break;
          }
        }
      }
    }
    for (const [i, j] of add) {
      tail[i] = tail[j];
      tail[i + 1] = tail[j + 1];
      tail[i + 2] = tail[j + 2];
      tail[i + 3] = 255;
    }
  }
  return { body, tail };
}
