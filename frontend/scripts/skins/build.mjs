// Кодирование арта скинов (HD-результат compose.py в .work/<id>/) в файлы игры, в нескольких размерах
// (src/game/skinSizes.json): игра берёт наименьший, которого хватает экрану (CSS px × devicePixelRatio), —
// большая картинка не растягивается браузером из маленькой, а маленький экран не грузит лишнего.
//   public/assets/skins/<id>/character-<высота>.{avif,webp}  — персонаж с прозрачным фоном
//   public/assets/skins/<id>/background-<ширина>.{avif,webp} — сцена без персонажа, продлённая за края
//   public/assets/skins/<id>/card-<ширина>.{avif,webp}       — фон карточки коллекции: кадр 4:5 из сцены
//                                                              вокруг места персонажа (сам персонаж в карточке —
//                                                              отдельный резкий слой поверх, рамка — manifest.card)
//   public/assets/skins/<id>/icon.webp                       — портрет (аватар в профиле)
// и манифест src/game/skinArt.json (пропорции, голова, центр тела — по ним раскладывается сцена).
// Картинки не растягиваются: только уменьшение (если исходник меньше размера — размер пропускается).
// `node scripts/skins/build.mjs card` — перекодировать только фоны карточек.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const work = path.join(here, '.work');
const outRoot = path.join(root, 'public', 'assets', 'skins');
const manifestPath = path.join(root, 'src', 'game', 'skinArt.json');
/** размеры: персонаж — по высоте, фон и карточка — по ширине (их же читает игра, src/game/skins.ts) */
const SIZES = JSON.parse(readFileSync(path.join(root, 'src', 'game', 'skinSizes.json'), 'utf8'));
const ICON = 512;

const round4 = (v) => Number(v.toFixed(4));
const fit = (s, w, h) =>
  s.resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });

/** Записать картинку во всех размерах (AVIF + WebP); исходник меньше размера — этот размер не нужен. */
async function writeSizes(image, out, name, axis, sizes, quality) {
  const meta = await image.metadata();
  const have = axis === 'h' ? meta.height : meta.width;
  for (const size of sizes) {
    if (size > have) throw new Error(`${out}/${name}: исходник ${have} px меньше размера ${size}`);
    const scaled = axis === 'h' ? fit(image.clone(), undefined, size) : fit(image.clone(), size);
    await scaled
      .clone()
      .webp(quality.webp)
      .toFile(path.join(out, `${name}-${size}.webp`));
    await scaled
      .clone()
      .avif(quality.avif)
      .toFile(path.join(out, `${name}-${size}.avif`));
  }
}

/** старые файлы без размера в имени (до разбиения на размеры) — удалить, чтобы не лежали мёртвым грузом */
function dropLegacy(out, name) {
  for (const ext of ['webp', 'avif']) rmSync(path.join(out, `${name}.${ext}`), { force: true });
}

/** Карточка коллекции 4:5: персонаж — не выше этой доли высоты, ступни — на этой высоте (доля сверху). */
const CARD_ASPECT = 4 / 5;
const CARD_CHAR_H = 0.86;
const CARD_FEET = 0.92;

/**
 * Рамка персонажа в карточке (доли карточки): высота и левый край. По центру — вертикаль тела; широкий
 * персонаж (шляпа, крылья) уменьшается, чтобы влезть по ширине.
 */
function cardFrame(meta, aspect) {
  const height = Math.min(CARD_CHAR_H, CARD_ASPECT / aspect);
  const width = (height * aspect) / CARD_ASPECT;
  return { height, left: 0.5 - meta.body * width, feet: CARD_FEET };
}

/**
 * Фон карточки: кадр 4:5 из сцены (без персонажа) там, где персонаж стоит в карточке, — в карточке он
 * ложится поверх точно на своё место (как на главном экране), отдельным резким слоем.
 */
async function writeCard(src, out, meta, aspect) {
  const bg = sharp(src('background.png'));
  const { width: sw, height: sh } = await bg.metadata();
  const [cx, cy, , chf] = meta.scene.char;
  const frame = cardFrame(meta, aspect);
  const charH = chf * sh;
  const cardH = charH / frame.height;
  const cardW = cardH * CARD_ASPECT;
  const left = Math.round(cx * sw - frame.left * cardW);
  const top = Math.round((cy + chf) * sh - frame.feet * cardH);
  if (left < 0 || top < 0 || left + cardW > sw || top + cardH > sh)
    throw new Error(`${out}: карточка за сценой`);
  const crop = sharp(
    await bg
      .extract({ left, top, width: Math.round(cardW), height: Math.round(cardH) })
      .png()
      .toBuffer(),
  );
  await writeSizes(crop, out, 'card', 'w', SIZES.card, {
    webp: { quality: 80, effort: 6 },
    avif: { quality: 52, effort: 6 },
  });
  dropLegacy(out, 'preview');
  for (const size of [480, 640, 720, 1080]) {
    for (const ext of ['webp', 'avif']) rmSync(path.join(out, `preview-${size}.${ext}`), { force: true });
  }
  return frame;
}

const onlyCard = process.argv.includes('card');
const ids = readdirSync(work).filter((d) => existsSync(path.join(work, d, 'meta.json')));
const manifest = {};
for (const id of ids.sort()) {
  const src = (f) => path.join(work, id, f);
  const out = path.join(outRoot, id);
  mkdirSync(out, { recursive: true });
  const meta = JSON.parse(readFileSync(src('meta.json'), 'utf8'));
  if (onlyCard) {
    const { width, height } = await sharp(src('character.png')).metadata();
    await writeCard(src, out, meta, width / height);
    console.log(`[skins] ${id}: карточка`);
    continue;
  }

  const character = sharp(src('character.png'));
  await writeSizes(character, out, 'character', 'h', SIZES.character, {
    webp: { quality: 88, alphaQuality: 92, smartSubsample: true, effort: 6 },
    avif: { quality: 64, effort: 6 },
  });
  dropLegacy(out, 'character');
  const { width, height } = await character.metadata();

  await writeSizes(sharp(src('background.png')), out, 'background', 'w', SIZES.background, {
    webp: { quality: 78, effort: 6 },
    avif: { quality: 50, effort: 6 },
  });
  dropLegacy(out, 'background');

  const card = await writeCard(src, out, meta, width / height);

  await fit(sharp(src('icon.png')), ICON, ICON)
    .webp({ quality: 84 })
    .toFile(path.join(out, 'icon.webp'));

  manifest[id] = {
    aspect: Number((width / height).toFixed(4)),
    head: meta.head,
    body: meta.body,
    headBottom: meta.headBottom,
    scene: meta.scene,
    card: { height: round4(card.height), left: round4(card.left), feet: card.feet },
    source: meta.source,
  };
  console.log(`[skins] ${id}: персонаж ${width}×${height}`);
}
if (!onlyCard) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[skins] ${ids.length} скинов → ${path.relative(root, outRoot)}, манифест ${path.relative(root, manifestPath)}`,
  );
}
