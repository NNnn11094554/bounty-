// Слои персонажа для анимации: тело, голова, ухо, хвост и правая кроссовка.
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

/**
 * Голова (уши, морда, усы) — по верхнему краю капюшона, оголовья и чашки наушников. Голова рисуется ПОД
 * телом: при наклоне её нижний край уходит под наушники и капюшон, как у настоящей шеи.
 */
export const HEAD_POLYGON = [
  [236, 0],
  [705, 0],
  [705, 364],
  [598, 364],
  [592, 346],
  [575, 338],
  [548, 335],
  [515, 333],
  [492, 330],
  [480, 322],
  [470, 310],
  [458, 302],
  [440, 296],
  [412, 291],
  [388, 289],
  [362, 282],
  [338, 279],
  [312, 283],
  [290, 290],
  [262, 294],
  [236, 296],
];

/** шея: вокруг неё поворачивается голова */
export const HEAD_PIVOT = [480, 335];

/**
 * Левое (большое) ухо — отдельный слой внутри головы, под ней: граница проведена по шерсти у основания
 * уха, под розовой частью и над крестиком на лбу. При подёргивании основание уходит под шерсть головы.
 */
export const EAR_POLYGON = [
  [296, 0],
  [470, 0],
  [482, 96],
  [456, 112],
  [430, 127],
  [405, 137],
  [380, 159],
  [350, 177],
  [322, 190],
  [296, 196],
];

/** основание уха: вокруг него оно подёргивается */
export const EAR_PIVOT = [400, 150];

/**
 * Правая кроссовка — под телом, граница по низу штанины. Кот притопывает: пятка поднимается, носок
 * стоит на месте, а верх кроссовки уходит под штанину.
 */
export const FOOT_POLYGON = [
  [400, 1062],
  [440, 1050],
  [470, 1047],
  [503, 1034],
  [520, 1005],
  [545, 997],
  [600, 995],
  [625, 1000],
  [705, 1000],
  [705, 1254],
  [400, 1254],
];

/** носок кроссовки — точка опоры при притопывании */
export const FOOT_PIVOT = [690, 1214];

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Перенести пиксели внутри контура из body в отдельный слой и продолжить слой под телом на steps пикселей. */
function cutLayer(body, src, W, H, poly, steps) {
  const layer = Buffer.alloc(src.length);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let y = Math.max(0, y0); y <= y1 && y < H; y++) {
    for (let x = Math.max(0, x0); x <= x1 && x < W; x++) {
      if (!inside(poly, x + 0.5, y + 0.5)) continue;
      const i = (y * W + x) * 4;
      src.copy(layer, i, i, i + 4);
      body[i + 3] = 0;
    }
  }
  // продолжение слоя под телом: steps шагов расширения в непрозрачные пиксели тела рядом с границей
  const ex0 = Math.max(0, x0 - 30);
  const ex1 = Math.min(W - 1, x1 + 30);
  const ey0 = Math.max(0, y0 - 30);
  const ey1 = Math.min(H - 1, y1 + 30);
  for (let step = 0; step < steps; step++) {
    const add = [];
    for (let y = ey0; y <= ey1; y++) {
      for (let x = ex0; x <= ex1; x++) {
        const i = (y * W + x) * 4;
        if (layer[i + 3] > 0 || body[i + 3] < 200) continue;
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
          if (layer[j + 3] > 200) {
            add.push([i, j]);
            break;
          }
        }
      }
    }
    for (const [i, j] of add) {
      layer[i] = layer[j];
      layer[i + 1] = layer[j + 1];
      layer[i + 2] = layer[j + 2];
      layer[i + 3] = 255;
    }
  }
  return layer;
}

/**
 * @param {Buffer} rgba — вырезанный персонаж, W×H
 * @returns {{ body: Buffer, head: Buffer, ear: Buffer, tail: Buffer, foot: Buffer }} слои того же размера
 */
export function splitLayers(rgba, W, H) {
  const body = Buffer.from(rgba);
  const tail = cutLayer(body, rgba, W, H, TAIL_POLYGON, 18);
  const foot = cutLayer(body, rgba, W, H, FOOT_POLYGON, 16);
  const head = cutLayer(body, rgba, W, H, HEAD_POLYGON, 16);
  // ухо вырезается уже из головы и продолжается под её шерстью
  const ear = cutLayer(head, Buffer.from(head), W, H, EAR_POLYGON, 12);
  return { body, head, ear, tail, foot };
}
