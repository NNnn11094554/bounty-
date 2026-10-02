// Перекраска персонажа в скины: меняется только синий неон (подсветка одежды, глаза, кроссовки,
// наушники, кнопка TAP); чёрная шерсть, розовые уши и тёплые блики остаются как есть. Для некоторых
// скинов белые детали (логотипы, подошвы, ремни) подкрашиваются — золото, тёмный металл и т.п.

const BLUE = 215;

/** глаза в координатах исходника — их белки не подкрашиваем */
const EYES = [
  [410, 186, 488, 262],
  [528, 246, 594, 298],
];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const angle = (a, b) => {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return d;
};

/**
 * @typedef {object} Recolor
 * @property {number | [number, number]} hue  оттенок неона; пара — градиент снизу вверх
 * @property {number} [sat]   множитель насыщенности неона
 * @property {number} [val]   множитель яркости неона
 * @property {[number, number, number, number]} [white]  подкраска белых деталей: цвет и сила 0…1
 */

/**
 * Перекрашивает RGBA-буфер на месте. origin — где этот буфер лежит в исходнике 1254×1254
 * (для градиента по высоте и чтобы не трогать белки глаз).
 * @param {Buffer} rgba
 * @param {Recolor} opts
 */
export function recolor(rgba, W, H, opts, origin = { x: 0, y: 0 }, srcH = 1254) {
  const sat = opts.sat ?? 1;
  const val = opts.val ?? 1;
  for (let y = 0; y < H; y++) {
    const sy = origin.y + y;
    const hue = Array.isArray(opts.hue)
      ? opts.hue[0] + (opts.hue[1] - opts.hue[0]) * smooth(0.15, 0.85, 1 - sy / srcH)
      : opts.hue;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (rgba[i + 3] === 0) continue;
      let r = rgba[i];
      let g = rgba[i + 1];
      let b = rgba[i + 2];
      const [h, s, v] = rgbToHsv(r, g, b);
      const dh = angle(h, BLUE);
      const wHue = 1 - smooth(42, 64, Math.abs(dh));
      const w = wHue * smooth(0.1, 0.3, s) * smooth(0.04, 0.16, v);
      if (w > 0) {
        const [nr, ng, nb] = hsvToRgb(hue + dh * 0.5, Math.min(1, s * sat), Math.min(1, v * val));
        r += (nr - r) * w;
        g += (ng - g) * w;
        b += (nb - b) * w;
      }
      if (opts.white) {
        const sx = origin.x + x;
        const inEye = EYES.some(([x0, y0, x1, y1]) => sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1);
        if (!inEye) {
          const ww = (1 - smooth(0.08, 0.24, s)) * smooth(0.5, 0.85, v) * opts.white[3];
          if (ww > 0) {
            r += ((r * opts.white[0]) / 255 - r) * ww;
            g += ((g * opts.white[1]) / 255 - g) * ww;
            b += ((b * opts.white[2]) / 255 - b) * ww;
          }
        }
      }
      rgba[i] = Math.round(Math.min(255, Math.max(0, r)));
      rgba[i + 1] = Math.round(Math.min(255, Math.max(0, g)));
      rgba[i + 2] = Math.round(Math.min(255, Math.max(0, b)));
    }
  }
  return rgba;
}

/**
 * Скины персонажа: id совпадают с каталогом @meowgul/shared (cosmetics.ts).
 * null — оригинальные цвета.
 * @type {Record<string, Recolor | null>}
 */
export const SKIN_RECOLORS = {
  black_crown: null,
  pink_angel: { hue: 330, sat: 0.72, val: 1.2, white: [255, 222, 238, 0.35] },
  cyber: { hue: 182, sat: 1.15, val: 1.08 },
  crypto_king: { hue: 30, sat: 1.1, val: 1.08, white: [255, 210, 140, 0.5] },
  samurai: { hue: 356, sat: 1.12, val: 1.0, white: [255, 196, 190, 0.3] },
  neon_tokyo: { hue: [285, 320], sat: 1.12, val: 1.08 },
  shadow: { hue: 268, sat: 1.0, val: 0.62, white: [80, 70, 100, 0.9] },
  galaxy: { hue: [232, 276], sat: 1.1, val: 1.1, white: [214, 200, 255, 0.45] },
  golden_boss: { hue: 48, sat: 1.2, val: 1.14, white: [255, 200, 90, 0.85] },
  hacker: { hue: 128, sat: 1.15, val: 1.05, white: [176, 255, 196, 0.4] },
  diamond: { hue: 196, sat: 0.45, val: 1.25 },
  queen: { hue: 346, sat: 1.1, val: 1.08, white: [255, 210, 120, 0.75] },
  legendary_crown: { hue: [200, 322], sat: 1.15, val: 1.1 },
};
