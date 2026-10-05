import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  Texture,
  type WebGLRenderer,
} from 'three';
import { catAsset, catSize, type CatFile } from '../cats';

/**
 * Текстуры: арт котов (AVIF, если браузер умеет, иначе WebP), процедурные свечения и картинки
 * на canvas. Цвета — как в файле (без преобразований), альфа — предумноженная (резкий край без ореола).
 */

let avifOk: boolean | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

/**
 * Картинка, готовая к загрузке в видеопамять: декодирование, предумножение альфы и переворот по вертикали —
 * вне главного потока (ImageBitmap). Иначе всё это браузер делает в момент загрузки текстуры, в главном потоке:
 * на телефоне — десятки мс на каждого кота, рывок посреди прокрутки.
 */
let bitmapsOk: Promise<boolean> | null = null;

/** ImageBitmap с переворотом работает (проверка на картинке 1×2: сверху должна оказаться нижняя точка). */
function bitmapsWork(): Promise<boolean> {
  bitmapsOk ??= (async () => {
    try {
      if (typeof createImageBitmap !== 'function') return false;
      const [src, ctx] = makeCanvas(1, 2);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 1, 1, 1);
      const bitmap = await createImageBitmap(src, {
        imageOrientation: 'flipY',
        premultiplyAlpha: 'premultiply',
      });
      const [out, octx] = makeCanvas(1, 2);
      octx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const top = octx.getImageData(0, 0, 1, 1).data;
      return out.height === 2 && top[2]! > 200 && top[0]! < 60;
    } catch {
      return false;
    }
  })();
  return bitmapsOk;
}

async function loadBitmap(src: string, alpha: boolean): Promise<ImageBitmap> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status} ${src}`);
  return createImageBitmap(await res.blob(), {
    imageOrientation: 'flipY',
    premultiplyAlpha: alpha ? 'premultiply' : 'none',
    colorSpaceConversion: 'none',
  });
}

/** Уменьшенная копия для маски силуэта (160 строк); без поддержки resize — null (маска из исходника). */
async function smallCopy(img: ImageBitmap): Promise<ImageBitmap | null> {
  const h = 160;
  const w = Math.max(1, Math.round((img.width / img.height) * h));
  try {
    return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });
  } catch {
    return null;
  }
}

async function loadSource(src: string, alpha: boolean): Promise<HTMLImageElement | ImageBitmap> {
  if (await bitmapsWork()) {
    try {
      return await loadBitmap(src, alpha);
    } catch (e) {
      // fetch недоступен (строгая политика CSP, особый WebView) — дальше только через <img>;
      // формат не декодировался — <img> попробует сам, а дальше loadArt перейдёт на WebP
      if (e instanceof TypeError) bitmapsOk = Promise.resolve(false);
    }
  }
  return loadImage(src);
}

/** Картинка арта: AVIF, при ошибке — WebP (и дальше сразу WebP). */
async function loadArt(id: string, file: CatFile, size: number): Promise<HTMLImageElement | ImageBitmap> {
  const alpha = file === 'character';
  if (avifOk !== false) {
    try {
      const img = await loadSource(catAsset(id, file, size, 'avif'), alpha);
      avifOk = true;
      return img;
    } catch {
      avifOk = false;
    }
  }
  return loadSource(catAsset(id, file, size, 'webp'), alpha);
}

export class TextureBank {
  private cache = new Map<string, Promise<Texture>>();

  constructor(
    private renderer: WebGLRenderer,
    /** дождаться спокойного момента перед загрузкой в видеопамять (не посреди перелёта камеры) */
    private settle: () => Promise<void> = () => Promise.resolve(),
  ) {}

  private prepare(texture: Texture, alpha: boolean): Texture {
    texture.colorSpace = NoColorSpace;
    texture.premultiplyAlpha = alpha;
    // анизотропия нужна только поверхностям под острым углом к взгляду; арт котов, миры и свечения всегда
    // повёрнуты к камере — для них она не меняет картинку, но стоит выборок
    texture.anisotropy = 1;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Арт кота нужного размера: cssPx — сколько CSS px он занимает на экране (персонаж — по высоте,
   * мир — по ширине). Текстура сразу загружается в видеопамять — без рывка при первом показе.
   */
  art(id: string, file: CatFile, cssPx: number, ratio: number): Promise<Texture> {
    const size = catSize(file, cssPx, ratio);
    const key = `${id}/${file}/${size}`;
    let p = this.cache.get(key);
    if (!p) {
      p = loadArt(id, file, size).then(async (img) => {
        const texture = this.prepare(new Texture(img), file === 'character');
        if (img instanceof HTMLImageElement) {
          await this.settle();
          this.renderer.initTexture(texture);
          return texture;
        }
        // ImageBitmap уже перевёрнут и с предумноженной альфой — WebGL эти флаги для него и не применяет
        texture.flipY = false;
        texture.premultiplyAlpha = false;
        // для попадания тапом по силуэту — маленькая копия (160 строк), уменьшенная вне главного потока
        if (file === 'character') texture.userData.maskImage = await smallCopy(img);
        await this.settle();
        this.renderer.initTexture(texture);
        // пиксели уже в видеопамяти: декодированная копия в памяти страницы больше не нужна (у <img> браузер
        // выгружает её сам, ImageBitmap держит до close() — десятки МБ на всех котов)
        texture.image = { width: img.width, height: img.height };
        img.close();
        return texture;
      });
      this.cache.set(key, p);
    }
    return p;
  }

  canvas(canvas: HTMLCanvasElement, alpha = true): Texture {
    const texture = this.prepare(new CanvasTexture(canvas), alpha);
    this.renderer.initTexture(texture);
    return texture;
  }
}

export function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas');
  return [canvas, ctx];
}

/** Мягкое круглое свечение (ореолы, лужи света, вспышки). */
export function glowCanvas(size = 256): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Луч света: яркая середина, мягкие края, к концу гаснет. */
export function rayCanvas(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(128, 512);
  const across = ctx.createLinearGradient(0, 0, 128, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, 128, 512);
  ctx.globalCompositeOperation = 'destination-in';
  const along = ctx.createLinearGradient(0, 0, 0, 512);
  along.addColorStop(0, 'rgba(255,255,255,0.9)');
  along.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, 128, 512);
  return canvas;
}

/** Кольцо-обод (подсветка постамента, кольцо прогресса): тонкая светящаяся окружность. */
export function ringCanvas(size = 512, width = 0.035): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, r * (0.86 - width * 3), r, r, r * 0.98);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.86, 'rgba(255,255,255,1)');
  g.addColorStop(0.92, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Рельеф монеты PAW: лапа и обод (альфа — высота рельефа). */
export function pawReliefCanvas(size = 512): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const s = size / 48;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.arc(24 * s, 24 * s, 20.6 * s, 0, Math.PI * 2);
  ctx.stroke();
  const ellipse = (x: number, y: number, rx: number, ry: number, rot: number) => {
    ctx.beginPath();
    ctx.ellipse(x * s, y * s, rx * s, ry * s, (rot * Math.PI) / 180, 0, Math.PI * 2);
    ctx.fill();
  };
  // лапа — как на монете в игре (components/icons CoinIcon)
  ellipse(24, 27.6, 5.6, 4.7, 0);
  ellipse(17.2, 22, 2.3, 2.85, -18);
  ellipse(21.3, 17.8, 2.3, 2.95, -6);
  ellipse(26.7, 17.8, 2.3, 2.95, 6);
  ellipse(30.8, 22, 2.3, 2.85, 18);
  // мягкий край рельефа
  const soft = makeCanvas(size, size);
  soft[1].filter = `blur(${Math.round(size / 220)}px)`;
  soft[1].drawImage(canvas, 0, 0);
  return soft[0];
}

/** SVG-разметка → картинка на canvas (иконки активов из игры). */
export async function svgCanvas(svg: string, size: number): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const [canvas, ctx] = makeCanvas(size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Бесшовный шум (4 октавы, как fbm в шейдерах) для мокрого стекла пола: считается один раз здесь, а не
 * на каждом пикселе в каждом кадре. cells — ячеек шума на плитку по стороне; плитка повторяется без шва.
 */
export function noiseCanvas(size = 256, cells = 8): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const hash = (x: number, y: number, period: number) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    let h = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(period, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const vnoise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const ux = smooth(x - ix);
    const uy = smooth(y - iy);
    const a = hash(ix, iy, period) + (hash(ix + 1, iy, period) - hash(ix, iy, period)) * ux;
    const b = hash(ix, iy + 1, period) + (hash(ix + 1, iy + 1, period) - hash(ix, iy + 1, period)) * ux;
    return a + (b - a) * uy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.5;
      for (let o = 0, period = cells; o < 4; o++, period *= 2, amp *= 0.5)
        v += amp * vnoise((x / size) * period, (y / size) * period, period);
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(v * 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
