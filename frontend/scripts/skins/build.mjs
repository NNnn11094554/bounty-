// Кодирование арта скинов (результат compose.py в .work/<id>/) в файлы игры:
//   public/assets/skins/<id>/character.{avif,webp} — персонаж с прозрачным фоном, в своём разрешении
//   public/assets/skins/<id>/background.{avif,webp} — сцена без персонажа, продлённая за края
//   public/assets/skins/<id>/preview.{avif,webp}    — картинка карточки коллекции
//   public/assets/skins/<id>/icon.webp              — портрет (аватар в профиле)
// и манифест src/game/skinArt.json (пропорции, голова, центр тела — по ним раскладывается сцена).
// Картинки не растягиваются: только уменьшение до нужного размера.
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
const PREVIEW_W = 360;
const ICON = 512;

const fit = (s, w, h) => s.resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true });

const ids = readdirSync(work).filter((d) => existsSync(path.join(work, d, 'meta.json')));
const manifest = {};
for (const id of ids.sort()) {
  const src = (f) => path.join(work, id, f);
  const out = path.join(outRoot, id);
  mkdirSync(out, { recursive: true });
  const meta = JSON.parse(readFileSync(src('meta.json'), 'utf8'));

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

  const preview = fit(sharp(src('preview.png')), PREVIEW_W);
  await preview.clone().webp({ quality: 80, effort: 6 }).toFile(path.join(out, 'preview.webp'));
  await preview.clone().avif({ quality: 52, effort: 6 }).toFile(path.join(out, 'preview.avif'));

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
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `[skins] ${ids.length} скинов → ${path.relative(root, outRoot)}, манифест ${path.relative(root, manifestPath)}`,
);
