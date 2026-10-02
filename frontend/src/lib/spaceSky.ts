/**
 * Ночное небо для фона: почти чёрный космос, сине-серая туманность полосой (как Млечный Путь),
 * густая россыпь мелких звёзд и несколько ярких с лучами. Рисуется процедурно (без картинок) с
 * фиксированным зерном — небо одинаковое при каждом запуске.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Плавный «облачный» шум (value noise + fBm). */
function makeFbm(seed: number, octaves: number): (x: number, y: number) => number {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]!;
  const vals = Float32Array.from({ length: 256 }, () => rand());
  const lattice = (ix: number, iy: number) => vals[perm[(ix & 255) + perm[iy & 255]!]!]!;
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = lattice(ix, iy);
    const b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1);
    const d = lattice(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Плотность полосы туманности: диагональ через экран, мягкие края. */
function bandAt(u: number, v: number): number {
  // линия от левого нижнего к правому верхнему углу (в долях экрана)
  const d = (u * 0.8 + v * 0.6 - 0.72) / 1;
  return Math.exp(-(d * d) / (2 * 0.17 * 0.17));
}

function drawNebula(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  res: number,
  seed: number,
  alpha: number,
) {
  const nw = res;
  const nh = Math.max(1, Math.round((res * h) / w));
  const layer = document.createElement('canvas');
  layer.width = nw;
  layer.height = nh;
  const lctx = layer.getContext('2d');
  if (!lctx) return;
  const img = lctx.createImageData(nw, nh);
  const cloud = makeFbm(seed, 5);
  const dust = makeFbm(seed + 17, 4);
  const scale = 5 / nw;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const u = x / nw;
      const v = y / nh;
      const band = bandAt(u, v);
      const c = cloud(x * scale, y * scale);
      // облака гуще к центру полосы, редкая дымка по всему небу
      let a = smooth(0.32, 0.86, c) * (0.18 + band * 0.95);
      // тёмные прожилки пыли
      a *= 1 - smooth(0.55, 0.8, dust(x * scale * 1.7 + 11, y * scale * 1.7)) * 0.75;
      const lit = smooth(0.45, 0.95, c);
      const i = (y * nw + x) * 4;
      img.data[i] = 34 + lit * 70; // R
      img.data[i + 1] = 48 + lit * 80; // G
      img.data[i + 2] = 92 + lit * 95; // B
      img.data[i + 3] = Math.round(Math.min(1, a) * 255 * alpha);
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(layer, 0, 0, w, h);
}

const STAR_TINTS = ['255,255,255', '255,255,255', '214,226,255', '190,210,255', '255,244,226'];

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const rand = mulberry32(seed);
  const count = Math.round((w * h) / 420);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    // в полосе туманности звёзд больше — как в Млечном Пути
    if (rand() > 0.3 + 0.7 * bandAt(x / w, y / h)) continue;
    const tint = STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)]!;
    const r = rand() < 0.9 ? 0.25 + rand() * 0.45 : 0.7 + rand() * 0.6;
    ctx.fillStyle = `rgba(${tint},${(0.25 + rand() * 0.7).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // заметные звёзды с мягким ореолом
  for (let i = 0; i < Math.round((w * h) / 22000); i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.9 + rand() * 0.8;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    g.addColorStop(0, 'rgba(225,235,255,0.95)');
    g.addColorStop(0.2, 'rgba(170,195,255,0.35)');
    g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Нарисовать небо на canvas размером w×h CSS-пикселей. */
export function renderSky(canvas: HTMLCanvasElement, w: number, h: number, dpr: number): void {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#02030a');
  bg.addColorStop(0.55, '#040612');
  bg.addColorStop(1, '#02030a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // крупные облака + тонкие волокна поверх
  drawNebula(ctx, w, h, 96, 7, 0.75);
  drawNebula(ctx, w, h, 220, 19, 0.45);
  drawStars(ctx, w, h, 20261002);
}

/** Небо картинкой (для экранов поверх вкладок): JPEG, чтобы строка была небольшой. */
export function skyDataUrl(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}
