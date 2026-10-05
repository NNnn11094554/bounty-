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

/** Картинка арта: AVIF, при ошибке — WebP (и дальше сразу WebP). */
async function loadArt(id: string, file: CatFile, size: number): Promise<HTMLImageElement> {
  if (avifOk !== false) {
    try {
      const img = await loadImage(catAsset(id, file, size, 'avif'));
      avifOk = true;
      return img;
    } catch {
      avifOk = false;
    }
  }
  return loadImage(catAsset(id, file, size, 'webp'));
}

export class TextureBank {
  private cache = new Map<string, Promise<Texture>>();
  private maxAnisotropy: number;

  constructor(private renderer: WebGLRenderer) {
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  private prepare(texture: Texture, alpha: boolean): Texture {
    texture.colorSpace = NoColorSpace;
    texture.premultiplyAlpha = alpha;
    texture.anisotropy = Math.min(8, this.maxAnisotropy);
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
      p = loadArt(id, file, size).then((img) => {
        const texture = this.prepare(new Texture(img), file === 'character');
        this.renderer.initTexture(texture);
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
