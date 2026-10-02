// Готовит изображения персонажа: слои и скины (scripts/hero), портрет для иконок, WebP-размеры,
// иконки приложения и сцену для превью ссылок и приветствия бота.
// Исходник — assets-src/hero.png (кот и кнопка TAP на «шахматке»), всё остальное собирается из него.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildHero, HERO_PORTRAIT } from './hero/build.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'public', 'assets', 'generated');
mkdirSync(out, { recursive: true });

const hero = await buildHero(out);
// портрет (голова и плечи кота на тёмно-синем фоне) — источник иконок, аватаров и экрана загрузки
const input = hero.portrait;
const srcMtime = statSync(HERO_PORTRAIT).mtimeMs;
const fresh = (file) => existsSync(file) && statSync(file).mtimeMs >= srcMtime;

const jobs = [
  ['character-512.webp', (s) => s.resize(512, 512).webp({ quality: 86, effort: 5 })],
  ['character-1024.webp', (s) => s.resize(1024, 1024).webp({ quality: 86, effort: 5 })],
  ['character-512.png', (s) => s.resize(512, 512).png({ compressionLevel: 9 })],
  ['character-256.webp', (s) => s.resize(256, 256).webp({ quality: 84 })],
  ['icon-192.png', (s) => s.resize(192, 192).png()],
  ['icon-512.png', (s) => s.resize(512, 512).png()],
  ['favicon-64.png', (s) => s.resize(64, 64).png()],
];

let made = hero.made;
for (const [name, transform] of jobs) {
  const file = path.join(out, name);
  if (fresh(file)) continue;
  await transform(sharp(input)).toFile(file);
  made++;
}

// Космическая сцена в стиле фона игры: тёмное небо, туманность полосой, звёзды, кот в золотом круге.
// Используется для Open Graph (превью ссылки) и картинки приветствия бота.
function rand32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** плотность полосы туманности (как в lib/spaceSky.ts): диагональ снизу слева вверх направо */
const band = (u, v) => Math.exp(-((u * 0.8 + v * 0.6 - 0.72) ** 2) / (2 * 0.17 * 0.17));

function sparkle(x, y, r, id) {
  return `<g transform="translate(${x} ${y})">
    <circle r="${r * 0.55}" fill="url(#halo)"/>
    <rect x="${-r}" y="${-r * 0.035}" width="${r * 2}" height="${r * 0.07}" fill="url(#rayh${id})"/>
    <rect x="${-r * 0.035}" y="${-r}" width="${r * 0.07}" height="${r * 2}" fill="url(#rayv${id})"/>
    <circle r="${r * 0.09}" fill="#fff"/>
  </g>`;
}

async function spaceScene(w, h, { cta }) {
  const R = Math.round(h * 0.37);
  const cx = Math.round(w * 0.27);
  const cy = Math.round(h * 0.5);
  const rnd = rand32(20261002);
  let stars = '';
  for (let i = 0; i < Math.round((w * h) / 1100); i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (rnd() > 0.3 + 0.7 * band(x / w, y / h)) continue;
    const r = rnd() < 0.9 ? 0.5 + rnd() * 0.9 : 1.3 + rnd() * 1.1;
    const tint = ['#ffffff', '#ffffff', '#d6e2ff', '#bed2ff', '#fff4e2'][Math.floor(rnd() * 5)];
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${tint}" opacity="${(0.3 + rnd() * 0.7).toFixed(2)}"/>`;
  }
  const s = h / 720;
  const sparkles = [
    [0.93, 0.12, 34],
    [0.97, 0.2, 20],
    [0.58, 0.1, 22],
    [0.88, 0.86, 26],
    [0.05, 0.08, 18],
    [0.47, 0.9, 16],
  ]
    .map(([u, v, r], i) => sparkle(u * w, v * h, r * s, i % 2))
    .join('');
  const rays = [0, 1]
    .map(
      (i) =>
        `<linearGradient id="rayh${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="${i ? 0.8 : 0.95}"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></linearGradient>` +
        `<linearGradient id="rayv${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="${i ? 0.8 : 0.95}"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></linearGradient>`,
    )
    .join('');
  const tx = Math.round(w * 0.535);
  const font = 'DejaVu Sans, Liberation Sans, Arial, sans-serif';
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02030a"/><stop offset="0.55" stop-color="#050818"/><stop offset="1" stop-color="#02030a"/></linearGradient>
      <linearGradient id="bandg" gradientUnits="userSpaceOnUse" x1="0" y1="${h}" x2="${w * 0.62}" y2="${h - w * 0.62 * 1.33}">
        <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0.25"/>
      </linearGradient>
      <mask id="bandm"><rect width="${w}" height="${h}" fill="url(#bandg)"/></mask>
      <filter id="cloud" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="${(0.0032 / s).toFixed(5)} ${(0.0045 / s).toFixed(5)}" numOctaves="5" seed="7"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.21  0 0 0 0 0.29  0 0 0 0 0.52  2.4 0 0 0 -0.95"/>
      </filter>
      <filter id="core" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="${(0.006 / s).toFixed(5)}" numOctaves="4" seed="19"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.71  0 0 0 0 0.92  3 0 0 0 -1.75"/>
      </filter>
      <radialGradient id="halo"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.25" stop-color="#cfe0ff" stop-opacity="0.45"/><stop offset="1" stop-color="#8fb0ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#2f6bff" stop-opacity="0.45"/><stop offset="1" stop-color="#2f6bff" stop-opacity="0"/></radialGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff5f6d"/></linearGradient>
      ${rays}
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <g mask="url(#bandm)">
      <rect width="${w}" height="${h}" filter="url(#cloud)" opacity="0.9"/>
      <rect width="${w}" height="${h}" filter="url(#core)" opacity="0.55"/>
    </g>
    ${stars}${sparkles}
    <circle cx="${cx}" cy="${cy}" r="${R * 1.3}" fill="url(#glow)"/>
    <text x="${tx}" y="${Math.round(h * (cta ? 0.42 : 0.5))}" font-family="${font}" font-size="${Math.round(100 * s)}" font-weight="bold" fill="#ffffff">Meowgul</text>
    <text x="${tx + 4 * s}" y="${Math.round(h * (cta ? 0.52 : 0.6))}" font-family="${font}" font-size="${Math.round(34 * s)}" font-weight="bold" fill="#ffc93c">Tap · Build · Earn PAW</text>
    ${
      cta
        ? `<rect x="${tx + 4 * s}" y="${Math.round(h * 0.6)}" width="${Math.round(300 * s)}" height="${Math.round(72 * s)}" rx="${Math.round(36 * s)}" fill="url(#cta)"/>
    <text x="${tx + 4 * s + 150 * s}" y="${Math.round(h * 0.6 + 48 * s)}" text-anchor="middle" font-family="${font}" font-size="${Math.round(32 * s)}" font-weight="bold" fill="#fff">Play now</text>`
        : ''
    }
  </svg>`;
  // кот в полный рост (слои скина по умолчанию: хвост и голова под телом)
  const catH = Math.round(h * 0.94);
  const layer = (part) => path.join(out, 'hero', `black_crown-${part}.webp`);
  const catImg = await sharp(layer('tail'))
    .composite([{ input: layer('head') }, { input: layer('body') }])
    .png()
    .toBuffer()
    .then((b) => sharp(b).resize(null, catH).png().toBuffer());
  const catW = (await sharp(catImg).metadata()).width ?? 0;
  return sharp(Buffer.from(svg)).composite([
    { input: catImg, left: Math.max(0, Math.round(cx - catW / 2)), top: h - catH },
  ]);
}

// Open Graph 1200×630 (превью ссылки на игру)
const og = path.join(out, 'og-image.jpg');
if (!fresh(og)) {
  await (await spaceScene(1200, 630, { cta: true })).jpeg({ quality: 88, mozjpeg: true }).toFile(og);
  made++;
}

// Картинка приветствия бота 1280×720 (кнопка «Играть» — под сообщением, на картинке её нет)
const welcome = path.join(out, 'welcome.jpg');
if (!fresh(welcome)) {
  await (await spaceScene(1280, 720, { cta: false })).jpeg({ quality: 88, mozjpeg: true }).toFile(welcome);
  made++;
}

console.log(`[assets] ${made ? `обновлено файлов: ${made}` : 'актуальны'}`);
