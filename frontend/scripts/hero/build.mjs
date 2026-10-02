// Сборка персонажа из assets-src/hero.png: ретушь, вырезка из «шахматки», слои (тело, голова, хвост),
// скины-перекраски и квадратный портрет для иконок, аватаров и превью ссылок.
// В исходнике справа нарисована ещё и кнопка TAP — в игре её нет (тапают по коту), в сборку она не идёт.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { bbox, cutout, SPLIT_X } from './cutout.mjs';
import { EAR_PIVOT, FOOT_PIVOT, HEAD_PIVOT, splitLayers, TAIL_PIVOT } from './layers.mjs';
import { recolor, SKIN_RECOLORS } from './recolor.mjs';
import { eraseStrapText } from './retouch.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
export const HERO_SOURCE = path.join(root, 'assets-src', 'hero.png');
const LAYOUT = path.join(root, 'src', 'game', 'heroLayout.json');
export const HERO_PORTRAIT = path.join(root, '.cache', 'hero-portrait.png');

/** высота превью; слои главного экрана — в полном разрешении исходника (без лишнего уменьшения) */
const THUMB_H = 384;
const LAYERS = ['body', 'head', 'ear', 'tail', 'foot'];
const PARTS = [...LAYERS, 'thumb'];

const webp = (s, q = 86) => s.webp({ quality: q, alphaQuality: 90, effort: 5 });
// слои кота: высокое качество, полный цвет на неоновых краях (smartSubsample), лёгкая резкость только на краях
const layerWebp = (s) =>
  s.sharpen({ sigma: 0.5, m1: 0, m2: 0.8 }).webp({
    quality: 92,
    alphaQuality: 100,
    smartSubsample: true,
    effort: 6,
  });

/** Пора ли пересобирать: исходник или скрипты новее результата. */
function stale(file) {
  if (!existsSync(file)) return true;
  const t = statSync(file).mtimeMs;
  const deps = [
    HERO_SOURCE,
    LAYOUT,
    ...['build.mjs', 'cutout.mjs', 'layers.mjs', 'recolor.mjs', 'retouch.mjs'].map((f) => path.join(here, f)),
  ];
  return deps.some((d) => statSync(d).mtimeMs > t);
}

function crop(rgba, W, box) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const sx = box.left + x;
      if (sx >= SPLIT_X) continue;
      const si = ((box.top + y) * W + sx) * 4;
      rgba.copy(out, (y * box.width + x) * 4, si, si + 4);
    }
  }
  return out;
}

const raw = (buf, box) => sharp(buf, { raw: { width: box.width, height: box.height, channels: 4 } });

/**
 * @param {string} outDir  public/assets/generated
 * @returns {Promise<{ made: number, portrait: Buffer }>} портрет 1254×1254 — исходник для иконок
 */
export async function buildHero(outDir) {
  const dir = path.join(outDir, 'hero');
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.dirname(HERO_PORTRAIT), { recursive: true });
  const layout = JSON.parse(readFileSync(LAYOUT, 'utf8'));
  const ids = Object.keys(SKIN_RECOLORS);
  const files = ids.flatMap((id) => PARTS.map((k) => path.join(dir, `${id}-${k}.webp`)));
  if (![HERO_PORTRAIT, ...files].some(stale)) return { made: 0, portrait: readFileSync(HERO_PORTRAIT) };

  const { data, info } = await sharp(HERO_SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  eraseStrapText(data, W);
  const rgba = cutout(data, W, H);
  const catBox = bbox(rgba, W, H, 0, SPLIT_X);
  if (JSON.stringify(catBox) !== JSON.stringify(layout.cat)) {
    throw new Error(
      `[hero] рамка кота ${JSON.stringify(catBox)} не совпадает с heroLayout.json — обновите файл`,
    );
  }
  for (const [name, value] of [
    ['tailPivot', TAIL_PIVOT],
    ['headPivot', HEAD_PIVOT],
    ['earPivot', EAR_PIVOT],
    ['footPivot', FOOT_PIVOT],
  ]) {
    if (JSON.stringify(value) !== JSON.stringify(layout[name]))
      throw new Error(`[hero] ${name} ≠ heroLayout.json`);
  }

  const layers = splitLayers(rgba, W, H);
  const crops = Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, crop(v, W, catBox)]));

  let made = 0;
  for (const id of ids) {
    const opts = SKIN_RECOLORS[id];
    const png = {};
    for (const part of LAYERS) {
      const buf = Buffer.from(crops[part]);
      if (opts) recolor(buf, catBox.width, catBox.height, opts, { x: catBox.left, y: catBox.top }, H);
      png[part] = await raw(buf, catBox).png().toBuffer();
      await layerWebp(sharp(png[part])).toFile(path.join(dir, `${id}-${part}.webp`));
      made++;
    }
    // превью одной картинкой: хвост, кроссовка, ухо и голова под телом
    const whole = await sharp(png.tail)
      .composite([{ input: png.foot }, { input: png.ear }, { input: png.head }, { input: png.body }])
      .png()
      .toBuffer();
    await webp(sharp(whole).resize(null, THUMB_H), 82).toFile(path.join(dir, `${id}-thumb.webp`));
    made++;
  }

  // портрет для иконок, аватаров лиги и превью ссылок: голова и плечи на тёмно-синем фоне
  const S = 1254;
  const full = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer();
  const bust = await sharp(full)
    .extract({ left: 222, top: 0, width: 486, height: 486 })
    .resize(S, S)
    .png()
    .toBuffer();
  const bg = Buffer.from(
    `<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg"><defs>
      <radialGradient id="g" cx="0.5" cy="0.42" r="0.62"><stop offset="0" stop-color="#1f3a9e"/><stop offset="0.55" stop-color="#0e1640"/><stop offset="1" stop-color="#060917"/></radialGradient>
    </defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`,
  );
  const portrait = await sharp(bg)
    .composite([{ input: bust }])
    .png()
    .toBuffer();
  await sharp(portrait).toFile(HERO_PORTRAIT);
  made++;
  return { made, portrait };
}
