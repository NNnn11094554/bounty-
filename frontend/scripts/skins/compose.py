"""Сборка арта скинов из листа коллекции (assets-src/skins/collection.png).

Шаги (python3 compose.py [индексы]):
  1. плитка персонажа → апскейл ×4 (Real-ESRGAN anime 6B, ONNX, CPU);
  2. маска персонажа (BiRefNet через rembg), вырез мини-превью из угла плитки;
  3. персонаж (RGBA, обрезан по силуэту), фон сцены без персонажа (заливка + лёгкое размытие),
     картинка карточки и портрет — PNG в .work/<id>/; кодирование в WebP/AVIF — build.mjs.
Модели скачиваются в .work/models при первом запуске (см. README, раздел «Скины»).
"""
import json, os, sys, urllib.request
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'skins', 'collection.png')
WORK = os.path.join(HERE, '.work')
MODELS = os.path.join(WORK, 'models')

# порядок плиток на листе (5 × 4) — id скинов
IDS = ['shadow_drifter', 'arctic_king', 'cyber_samurai', 'astro_cat', 'royal_emperor',
       'inferno', 'angel_guardian', 'neon_punk', 'forest_spirit', 'vampire_lord',
       'ocean_guardian', 'crystal_prince', 'stealth_assassin', 'mecha', 'toxic',
       'lunar_witch', 'desert_nomad', 'dark_reaper', 'sakura_blossom', 'galaxy_emperor']
COLS = [(0, 254), (265, 520), (530, 784), (793, 1046), (1057, 1312)]
# картинка плитки без подписи (имя и редкость рисует интерфейс)
ROWS = [(0, 262), (313, 554), (604, 846), (896, 1138)]
# мини-превью в правом нижнем углу плитки (x0, y0, x1, y1 в пикселях плитки) — вырезается
INSET = [(176, 182, 250, 256), (176, 146, 250, 224), (176, 148, 250, 228), (176, 152, 250, 232)]
SCALE = 4
# персонажи, для которых есть карточка в высоком разрешении (assets-src/skins/hires/<id>.webp, 896×1152):
# берутся из неё без апскейла. Высота картинки без подписи и мини-превью (x0, y0, x1, y1) в её пикселях.
HIRES = {
    'sakura_blossom': (900, (644, 592, 891, 876)),
    'inferno': (905, (622, 644, 868, 905)),
    'lunar_witch': (900, (626, 606, 878, 881)),
    'desert_nomad': (900, (639, 604, 878, 878)),
    'toxic': (905, (649, 634, 891, 896)),
    'crystal_prince': (900, (636, 598, 890, 878)),
    'forest_spirit': (905, (632, 629, 878, 902)),
    'vampire_lord': (900, (646, 598, 892, 874)),
    'astro_cat': (1030, (639, 734, 884, 1006)),
}
# доуточнение маски, где нейросеть пропустила часть персонажа (светящийся хвост на тёмном фоне):
# рамка (x0, y0, x1, y1) и диапазон оттенка HSV — GrabCut добирает персонажа внутри рамки
MASK_HINTS = {
    'toxic': [((30, 330, 300, 735), (35, 85))],
}
RELEASES = {
    'esrgan.pth': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth',
}


def model(name):
    os.makedirs(MODELS, exist_ok=True)
    path = os.path.join(MODELS, name)
    if not os.path.exists(path):
        urllib.request.urlretrieve(RELEASES[name], path)
    return path


def upscale(tile):
    import onnxruntime as ort, subprocess
    onnx_path = os.path.join(MODELS, 'esrgan.onnx')
    if not os.path.exists(onnx_path):
        subprocess.check_call([sys.executable, os.path.join(HERE, 'esrgan_onnx.py'), model('esrgan.pth'), onnx_path])
    sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    x = tile[:, :, ::-1].astype(np.float32).transpose(2, 0, 1)[None] / 255
    y = sess.run(None, {'input': x})[0][0]
    return (np.clip(y, 0, 1).transpose(1, 2, 0)[:, :, ::-1] * 255 + 0.5).astype(np.uint8)


def segment(img):
    os.environ['U2NET_HOME'] = MODELS
    from rembg import new_session, remove
    from PIL import Image
    sess = new_session('birefnet-general')
    return np.array(remove(Image.fromarray(img[:, :, ::-1]), session=sess, only_mask=True))


def refine(img, m, hints):
    """GrabCut по подсказкам: уверенный персонаж — маска нейросети, вероятный — нужный оттенок в рамке."""
    gc = np.full(m.shape, cv2.GC_BGD, np.uint8)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    for (x0, y0, x1, y1), (h0, h1) in hints:
        gc[y0:y1, x0:x1] = cv2.GC_PR_BGD
        box = np.zeros(m.shape, bool)
        box[y0:y1, x0:x1] = True
        tint = (hsv[:, :, 0] > h0) & (hsv[:, :, 0] < h1) & (hsv[:, :, 1] > 90) & (hsv[:, :, 2] > 90)
        gc[box & tint] = cv2.GC_PR_FGD
    gc[m > 0.5] = cv2.GC_FGD
    bgm, fgm = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(img, gc, None, bgm, fgm, 6, cv2.GC_INIT_WITH_MASK)
    extra = ((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)).astype(np.float32)
    extra = cv2.GaussianBlur(extra, (0, 0), 1.2)
    return np.maximum(m, extra)


def fill(img, hole):
    """Заливка дыры (персонаж, мини-превью) окружающим фоном: пирамида push-pull + inpaint."""
    small = cv2.resize(img, None, fx=0.125, fy=0.125, interpolation=cv2.INTER_AREA)
    hs = cv2.resize(hole, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST)
    filled = cv2.inpaint(small, hs, 6, cv2.INPAINT_TELEA)
    # залитое место — мягкий расфокус цветов сцены, без «осколков» заливки
    filled = cv2.GaussianBlur(filled, (0, 0), 5)
    big = cv2.resize(filled, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    soft = np.clip(cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 12) * 1.6, 0, 1)[..., None]
    return (img * (1 - soft) + big * soft).astype(np.uint8)


def build(i):
    sid = IDS[i]
    out = os.path.join(WORK, sid)
    os.makedirs(out, exist_ok=True)
    up_path, mask_path = os.path.join(out, 'up.png'), os.path.join(out, 'mask.png')
    hires = HIRES.get(sid)
    if hires:
        bottom, (ix0, iy0, ix1, iy1) = hires
        card = cv2.imread(os.path.join(ROOT, 'assets-src', 'skins', 'hires', f'{sid}.webp'))
        if not os.path.exists(up_path) or os.path.getmtime(up_path) < os.path.getmtime(os.path.join(ROOT, 'assets-src', 'skins', 'hires', f'{sid}.webp')):
            cv2.imwrite(up_path, card[:bottom])
            if os.path.exists(mask_path):
                os.remove(mask_path)
    else:
        r, c = divmod(i, 5)
        (x0, x1), (y0, y1) = COLS[c], ROWS[r]
        ix0, iy0, ix1, iy1 = [v * SCALE for v in INSET[r]]
        if not os.path.exists(up_path):
            cv2.imwrite(up_path, upscale(cv2.imread(SRC)[y0:y1, x0:x1]))
    up = cv2.imread(up_path)
    if not os.path.exists(mask_path):
        cv2.imwrite(mask_path, segment(up))
    m = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255
    h, w = m.shape
    if sid in MASK_HINTS:
        m = refine(up, m, MASK_HINTS[sid])

    inset = np.zeros((h, w), np.uint8)
    cv2.rectangle(inset, (ix0, iy0), (min(ix1, w - 1), min(iy1, h - 1)), 255, -1)
    m[inset > 0] = 0
    # силуэт: крупнейшая часть и заметные куски рядом (оружие, крылья), без мусора
    b = (m > 0.35).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(b)
    if n > 1:
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        keep = np.array([k == big or (k > 0 and st[k, cv2.CC_STAT_AREA] > 0.004 * st[big, cv2.CC_STAT_AREA]) for k in range(n)])
        near = cv2.dilate(keep[lab].astype(np.uint8), np.ones((7, 7), np.uint8))
        m *= near
    # мягкий край без ореола фона
    m = np.clip((m - 0.08) / 0.84, 0, 1)
    alpha = (cv2.GaussianBlur(m, (0, 0), 0.6) * 255).astype(np.uint8)

    ys, xs = np.where(alpha > 12)
    pad = 6
    bx0, bx1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    by0, by1 = max(0, ys.min() - pad), min(h, ys.max() + 1)
    char = np.dstack([up, alpha])[by0:by1, bx0:bx1]
    cv2.imwrite(os.path.join(out, 'character.png'), char)

    ch, cw = char.shape[:2]
    a = char[:, :, 3].astype(np.float32)
    top = a[: int(ch * 0.3)]
    cols = top.sum(0)
    head_x = float((cols * np.arange(cw)).sum() / max(cols.sum(), 1)) / cw
    rows = top.sum(1)
    head_y = float((rows * np.arange(len(rows))).sum() / max(rows.sum(), 1)) / ch
    # где «тело»: средняя линия силуэта по всей высоте — по ней кот ставится в центр сцены
    allc = a.sum(0)
    body_x = float((allc * np.arange(cw)).sum() / max(allc.sum(), 1)) / cw

    hole = cv2.dilate(((m > 0.05) * 255).astype(np.uint8), np.ones((31, 31), np.uint8)) | inset
    # у карточек высокого разрешения по краю — рамка со скруглёнными углами: в фон и превью она не идёт
    edge = 18 if hires else 0
    trim = lambda im: im[edge:, edge:w - edge] if edge else im
    bg = fill(up, hole)
    bg = cv2.GaussianBlur(bg, (0, 0), 1.2)
    cv2.imwrite(os.path.join(out, 'background.png'), trim(bg))

    card = fill(up, cv2.dilate(inset, np.ones((15, 15), np.uint8)) & ~((m > 0.5) * 255).astype(np.uint8))
    cv2.imwrite(os.path.join(out, 'preview.png'), trim(card))

    # портрет: голова и плечи на фоне сцены
    size = int(min(ch * 0.46, cw * 1.0))
    cx, cy = bx0 + head_x * cw, by0 + head_y * ch + size * 0.14
    px0 = int(np.clip(cx - size / 2, 0, w - size)); py0 = int(np.clip(cy - size / 2, 0, h - size))
    cv2.imwrite(os.path.join(out, 'icon.png'), up[py0:py0 + size, px0:px0 + size])

    meta = {
        'width': int(cw), 'height': int(ch), 'source': 'card' if hires else 'sheet',
        'head': [round(head_x, 4), round(head_y, 4)],
        'body': round(body_x, 4),
        # нижний край головы ≈ 1.9 × центр головы по высоте (по силуэтам листа)
        'headBottom': round(min(0.45, head_y * 1.9), 4),
        # где стоит персонаж на фоне сцены (доли картинки фона) — сцена ставится так, чтобы он был в «своём» месте
        'anchor': [round((bx0 + body_x * cw - edge) / (w - 2 * edge), 4), round((by1 - edge) / (h - edge), 4)],
    }
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'))
    print(sid, meta, flush=True)


if __name__ == '__main__':
    for i in [int(a) for a in sys.argv[1:]] or range(len(IDS)):
        build(i)
