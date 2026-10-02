// Вырезка персонажа и кнопки TAP из исходной картинки: фон — «шахматка» прозрачности, нарисованная
// прямо в пикселях (светло-серые клетки 240/254), поэтому прозрачность восстанавливаем сами.
//
// 1. Фон — светлые нейтральные пиксели, связанные с краем картинки (заливка от краёв).
// 2. Закрытые «карманы» фона (между хвостом и ногой, между ногами) — области тех же пикселей, где
//    чередуются оба оттенка клеток; белые детали (надписи, подошвы) так не выглядят и остаются.
// 3. Края и свечение: «цвет в прозрачность» относительно белого — тёмный контур остаётся плотным,
//    бледный ореол кнопки становится полупрозрачным неоном.

/** левее — кот, правее — кнопка TAP (в исходнике они не пересекаются) */
export const SPLIT_X = 700;

const isBgPixel = (r, g, b) => {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mn >= 226 && mx - mn <= 6;
};

/**
 * @param {Buffer} rgb  — RGB без альфы, W×H
 * @returns {Buffer} RGBA той же картинки с восстановленной прозрачностью
 */
export function cutout(rgb, W, H) {
  const N = W * H;
  const pale = new Uint8Array(N);
  for (let i = 0; i < N; i++) pale[i] = isBgPixel(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) ? 1 : 0;

  // компоненты связности «фоновых» пикселей
  const comp = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  const bg = new Uint8Array(N);
  let id = 0;
  for (let s = 0; s < N; s++) {
    if (!pale[s] || comp[s] >= 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = s;
    comp[s] = id;
    let n = 0;
    let hi = 0;
    let lo = 0;
    let border = false;
    while (head < tail) {
      const i = queue[head++];
      const x = i % W;
      const y = (i / W) | 0;
      n++;
      const v = rgb[i * 3];
      if (v >= 250) hi++;
      if (v <= 244) lo++;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of near) {
        if (j >= 0 && pale[j] && comp[j] < 0) {
          comp[j] = id;
          queue[tail++] = j;
        }
      }
    }
    // фон: касается края, либо закрытый карман с клетками двух оттенков
    const isBg = border || (n >= 60 && hi / n >= 0.25 && lo / n >= 0.22);
    if (isBg) for (let k = 0; k < tail; k++) bg[queue[k]] = 1;
    id++;
  }

  // расстояние до фона (по 4-соседям) — для полосы сглаживания края
  const MAXD = 40;
  const dist = new Uint8Array(N).fill(255);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < N; i++) {
    if (bg[i]) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= MAXD) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of near) {
      if (j >= 0 && dist[j] === 255) {
        dist[j] = d + 1;
        queue[tail++] = j;
      }
    }
  }

  // ореол кнопки: бледные пиксели, достижимые от фона только через бледные (внутренние светлые линии
  // короны и буквы TAP отделены тёмно-синим телом кнопки и сюда не попадают)
  const glow = new Uint8Array(N);
  head = 0;
  tail = 0;
  for (let i = 0; i < N; i++) if (bg[i] && i % W >= SPLIT_X) queue[tail++] = i;
  const glowDepth = new Uint8Array(N);
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const y = (i / W) | 0;
    const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of near) {
      if (j < 0 || bg[j] || glow[j] || j % W < SPLIT_X) continue;
      const mn = Math.min(rgb[j * 3], rgb[j * 3 + 1], rgb[j * 3 + 2]);
      if (mn < 140) continue;
      const depth = (bg[i] ? 0 : glowDepth[i]) + 1;
      if (depth > 36) continue;
      glow[j] = 1;
      glowDepth[j] = depth;
      queue[tail++] = j;
    }
  }

  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    if (bg[i]) continue; // прозрачный
    let a = 1;
    let R = r;
    let G = g;
    let B = b;
    if (glow[i] || dist[i] <= 2) {
      // цвет в прозрачность относительно белого: P = a·F + (1 − a)·255
      a = (255 - Math.min(r, g, b)) / 255;
      if (a < 0.03) continue;
      R = Math.max(0, Math.min(255, (r - 255) / a + 255));
      G = Math.max(0, Math.min(255, (g - 255) / a + 255));
      B = Math.max(0, Math.min(255, (b - 255) / a + 255));
    }
    out[i * 4] = R;
    out[i * 4 + 1] = G;
    out[i * 4 + 2] = B;
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

/** Рамка непрозрачных пикселей в полосе x ∈ [x0, x1) с отступом pad. */
export function bbox(rgba, W, H, x0, x1, pad = 6) {
  let minx = W;
  let miny = H;
  let maxx = 0;
  let maxy = 0;
  for (let y = 0; y < H; y++) {
    for (let x = x0; x < x1; x++) {
      if (rgba[(y * W + x) * 4 + 3] > 8) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  const left = Math.max(x0, minx - pad);
  const top = Math.max(0, miny - pad);
  return {
    left,
    top,
    width: Math.min(x1, maxx + pad + 1) - left,
    height: Math.min(H, maxy + pad + 1) - top,
  };
}
