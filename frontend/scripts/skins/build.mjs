// Кодирование арта скинов (результат compose.py в .work/<id>/) в файлы игры:
//   public/assets/skins/<id>/character.{avif,webp} — персонаж с прозрачным фоном, в своём разрешении
//   public/assets/skins/<id>/background.{avif,webp} — сцена без персонажа, продлённая за края
//   public/assets/skins/<id>/preview.{avif,webp}    — картинка карточки коллекции: кадр 4:5 по коту
//   public/assets/skins/<id>/icon.webp              — портрет (аватар в профиле)
// и манифест src/game/skinArt.json (пропорции, голова, центр тела — по ним раскладывается сцена).
// Картинки не растягиваются: только уменьшение до нужного размера.
// `node scripts/skins/build.mjs preview` — перекодировать только картинки карточек (манифест не трогается).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const work = path.join(here, '.work');
const outRoot = path.join(root, 'public', 'assets', 'skins');
const manifestPath = path.join(root, 'src', 'game', 'skinArt.json');

/** не больше такой высоты персонажа и ширины фона — больше телефону не нужно */
const CHARACTER_MAX_H = 1100;
const BACKGROUND_MAX_W = 1500;
/** карточка коллекции 4:5 шириной ~190 CSS px: 640×800 — чётко и на экранах ×3 */
const PREVIEW_W = 640;
const PREVIEW_ASPECT = 4 / 5;
const ICON = 512;

const fit = (s, w, h) => s.resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true });

/**
 * Картинка карточки: кадр в пропорциях карточки (4:5), чтобы её не обрезал и не растягивал object-cover;
 * по горизонтали — по средней линии кота. Где кот на картинке — из сцены: фон — та же картинка, продлённая
 * в обе стороны поровну, рамка персонажа в нём известна.
 */
async function writePreview(src, out, meta) {
  const image = sharp(src('preview.png'));
  const { width: pw, height: ph } = await image.metadata();
  const { width: sw } = await sharp(src('background.png')).metadata();
  const [charX, , charW] = meta.scene.char;
  const bodyX = charX * sw - (sw - pw) / 2 + meta.body * charW * sw;
  const cw = Math.min(pw, Math.round(ph * PREVIEW_ASPECT));
  const ch = Math.min(ph, Math.round(cw / PREVIEW_ASPECT));
  const left = Math.round(Math.max(0, Math.min(pw - cw, bodyX - cw / 2)));
  const preview = fit(image.extract({ left, top: 0, width: cw, height: ch }), PREVIEW_W);
  await preview.clone().webp({ quality: 82, effort: 6 }).toFile(path.join(out, 'preview.webp'));
  await preview.clone().avif({ quality: 56, effort: 6 }).toFile(path.join(out, 'preview.avif'));
}

const onlyPreview = process.argv.includes('preview');
const ids = readdirSync(work).filter((d) => existsSync(path.join(work, d, 'meta.json')));
const manifest = {};
for (const id of ids.sort()) {
  const src = (f) => path.join(work, id, f);
  const out = path.join(outRoot, id);
  mkdirSync(out, { recursive: true });
  const meta = JSON.parse(readFileSync(src('meta.json'), 'utf8'));
  if (onlyPreview) {
    await writePreview(src, out, meta);
    console.log(`[skins] ${id}: превью`);
    continue;
  }

  const character = fit(sharp(src('character.png')), undefined, CHARACTER_MAX_H);
  await character
    .clone()
    .webp({ quality: 88, alphaQuality: 92, smartSubsample: true, effort: 6 })
    .toFile(path.join(out, 'character.webp'));
  await character.clone().avif({ quality: 62, effort: 6 }).toFile(path.join(out, 'character.avif'));
  const { width, height } = await character
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info);

  const background = fit(sharp(src('background.png')), BACKGROUND_MAX_W);
  await background.clone().webp({ quality: 76, effort: 6 }).toFile(path.join(out, 'background.webp'));
  await background.clone().avif({ quality: 48, effort: 6 }).toFile(path.join(out, 'background.avif'));

  await writePreview(src, out, meta);

  await fit(sharp(src('icon.png')), ICON, ICON)
    .webp({ quality: 84 })
    .toFile(path.join(out, 'icon.webp'));

  manifest[id] = {
    aspect: Number((width / height).toFixed(4)),
    head: meta.head,
    body: meta.body,
    headBottom: meta.headBottom,
    scene: meta.scene,
    source: meta.source,
  };
  console.log(`[skins] ${id}: ${width}×${height}`);
}
if (!onlyPreview) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[skins] ${ids.length} скинов → ${path.relative(root, outRoot)}, манифест ${path.relative(root, manifestPath)}`,
  );
}
