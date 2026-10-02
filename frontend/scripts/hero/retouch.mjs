// Ретушь исходника: надпись на ремне куртки убирается — в игре на персонаже нет посторонних названий.
// Ремень тёмный, буквы светлые: в полосе ремня светлые пиксели заменяются средним цветом тёмной ткани
// той же строки (ремень чуть наклонён, поэтому окно сдвигается по строкам). Корона ниже надписи остаётся.

/** надпись на ремне: строки y0…y1, окно по x на строке y0 и сдвиг окна на строку */
const STRAP = { y0: 534, y1: 640, x0: 423, x1: 464, slope: 0.06 };

const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** @param {Buffer} rgb — RGB исходника W×H, правится на месте */
export function eraseStrapText(rgb, W) {
  const rows = STRAP.y1 - STRAP.y0 + 1;
  // цвет ткани у левого и правого края ярлыка (там букв нет); тёмные пиксели, иначе — как строкой выше
  const left = [];
  const right = [];
  const sample = (y, xa, xb, prev) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let x = xa; x <= xb; x++) {
      const i = (y * W + x) * 3;
      if (lum(rgb[i], rgb[i + 1], rgb[i + 2]) < 58) {
        r += rgb[i];
        g += rgb[i + 1];
        b += rgb[i + 2];
        n++;
      }
    }
    return n ? [r / n, g / n, b / n] : prev;
  };
  for (let k = 0; k < rows; k++) {
    const y = STRAP.y0 + k;
    const shift = k * STRAP.slope;
    const x0 = Math.round(STRAP.x0 + shift);
    const x1 = Math.round(STRAP.x1 + shift);
    left.push(sample(y, x0 + 1, x0 + 3, left[k - 1] ?? [40, 34, 42]));
    right.push(sample(y, x1 - 3, x1 - 1, right[k - 1] ?? [40, 34, 42]));
  }
  // сглаживание по строкам — без полос
  const smooth = (arr) =>
    arr.map((_, k) => {
      const acc = [0, 0, 0];
      let n = 0;
      for (let j = Math.max(0, k - 6); j <= Math.min(rows - 1, k + 6); j++) {
        acc[0] += arr[j][0];
        acc[1] += arr[j][1];
        acc[2] += arr[j][2];
        n++;
      }
      return acc.map((v) => v / n);
    });
  const L = smooth(left);
  const R = smooth(right);
  let seed = 7;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff - 0.5) * 3;
  };
  for (let k = 0; k < rows; k++) {
    const y = STRAP.y0 + k;
    const shift = k * STRAP.slope;
    const xa = Math.round(STRAP.x0 + shift) + 3;
    const xb = Math.round(STRAP.x1 + shift) - 3;
    for (let x = xa; x <= xb; x++) {
      const t = (x - xa) / Math.max(1, xb - xa);
      const i = (y * W + x) * 3;
      const n = noise();
      for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(L[k][c] + (R[k][c] - L[k][c]) * t + n);
    }
  }
  return rgb;
}
