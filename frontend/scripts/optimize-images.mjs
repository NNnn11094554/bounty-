// Готовит изображения персонажа: WebP 512/1024, PNG-фолбэк, иконки и OG-картинку.
// Оригинал public/assets/character.png используется как есть — только масштабирование и сжатие.
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assets = path.join(root, 'public', 'assets');
const out = path.join(assets, 'generated');
const source = path.join(assets, 'character.png');
mkdirSync(out, { recursive: true });

const SIZE = 1254;
let input = source;
if (!existsSync(source)) {
  // Временная заглушка-круг того же размера, пока не положили character.png (см. README)
  console.warn('[assets] public/assets/character.png не найден — использую заглушку');
  input = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#2a2140"/></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
}

const srcMtime = existsSync(source) ? statSync(source).mtimeMs : 0;
const fresh = (file) => existsSync(file) && statSync(file).mtimeMs >= srcMtime && srcMtime > 0;

const jobs = [
  ['character-512.webp', (s) => s.resize(512, 512).webp({ quality: 86, effort: 5 })],
  ['character-1024.webp', (s) => s.resize(1024, 1024).webp({ quality: 86, effort: 5 })],
  ['character-512.png', (s) => s.resize(512, 512).png({ compressionLevel: 9 })],
  ['character-256.webp', (s) => s.resize(256, 256).webp({ quality: 84 })],
  ['icon-192.png', (s) => s.resize(192, 192).png()],
  ['icon-512.png', (s) => s.resize(512, 512).png()],
  ['favicon-64.png', (s) => s.resize(64, 64).png()],
];

let made = 0;
for (const [name, transform] of jobs) {
  const file = path.join(out, name);
  if (fresh(file)) continue;
  await transform(sharp(input)).toFile(file);
  made++;
}

// Open Graph 1200×630: тёплый фон, кот в круге с золотой обводкой, название игры
const og = path.join(out, 'og-image.png');
if (!fresh(og)) {
  const circle = 470;
  const cat = await sharp(input)
    .resize(circle, circle)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${circle}" height="${circle}"><circle cx="${circle / 2}" cy="${circle / 2}" r="${circle / 2}" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
  const bg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14101f"/><stop offset="1" stop-color="#1d1530"/></linearGradient>
      <radialGradient id="glow" cx="0.3" cy="0.5" r="0.45"><stop offset="0" stop-color="#ff8a3d" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
      <linearGradient id="cta" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff5f6d"/></linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <circle cx="355" cy="315" r="250" fill="none" stroke="#ffc93c" stroke-width="12"/>
    <text x="660" y="270" font-family="Nunito, Arial, sans-serif" font-size="96" font-weight="900" fill="#ffffff">Meowgul</text>
    <text x="664" y="340" font-family="Nunito, Arial, sans-serif" font-size="36" font-weight="700" fill="#ffc93c">Tap · Build · Earn PAW</text>
    <rect x="664" y="390" width="330" height="76" rx="38" fill="url(#cta)"/>
    <text x="829" y="440" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-size="34" font-weight="800" fill="#fff">Play now</text>
  </svg>`);
  await sharp(bg)
    .composite([{ input: cat, left: 355 - circle / 2, top: 315 - circle / 2 }])
    .png()
    .toFile(og);
  made++;
}

console.log(`[assets] ${made ? `обновлено файлов: ${made}` : 'актуальны'}`);
