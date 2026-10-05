"""Сборка арта скинов из листа коллекции (assets-src/skins/collection.png).

Шаги (python3 compose.py [индексы]):
  1. плитка персонажа → апскейл ×4 (Real-ESRGAN anime 6B, CPU) — по нему строятся маска и раскладка;
     HD-слой ×2 к нему же (hd.png): для листа — SwinIR-L ×4 по исходной плитке и Real-ESRGAN ×2,
     для карточек высокого разрешения — Real-ESRGAN ×2 по оригиналу без сжатия. Из HD-слоя режутся
     персонаж, фон, картинка карточки и портрет — геометрия (маска, рамки, разметка глаз) та же;
  2. маска персонажа (BiRefNet через rembg), вырез мини-превью из угла плитки;
  3. персонаж (RGBA, обрезан по силуэту);
  4. фон сцены: место персонажа, мини-превью и уголки рамки дорисовывает big-lama; сцена продлевается за
     края (зеркально, к краю мягче и темнее — там интерфейс), чтобы в игре персонаж стоял точно на своём
     месте и закрывал его, а фон заполнял экран;
  5. портрет — PNG в .work/<id>/; кодирование — build.mjs (несколько размеров: игра берёт тот, что нужен
     экрану, — без растягивания в браузере; фон карточки коллекции — кадр из сцены, персонаж поверх).
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
# расширение сцены по краям (доли исходной картинки): в игре сцена выше и шире, чем картинка персонажа
SCENE_PAD = {'left': 0.4, 'right': 0.4, 'top': 0.9, 'bottom': 0.5}
# сколько пикселей вокруг силуэта тоже дорисовать (полупрозрачный край персонажа)
HOLE_GROW = 9
# доуточнение маски, где нейросеть пропустила часть персонажа (светящийся хвост на тёмном фоне):
# рамка (x0, y0, x1, y1) и диапазон оттенка HSV — GrabCut добирает персонажа внутри рамки
MASK_HINTS = {
    'toxic': [((30, 330, 300, 735), (35, 85))],
}
# светлый диск за головой (луна), который маска приняла за персонажа: (область x0, y0 — доли персонажа:
# правее x0 и выше y0) и многоугольник, который оставить (ухо внутри диска), в тех же долях
HALO_CUTS = {
    'cyber_samurai': ((0.54, 0.266), [(0.841, 0.145), (0.962, 0.133), (0.926, 0.194), (0.903, 0.227), (0.867, 0.194)]),
}
RELEASES = {
    'big-lama.pt': 'https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt',
    'esrgan.pth': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth',
    'x2plus.pth': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth',
    'swinir-l.pth': 'https://github.com/JingyunLiang/SwinIR/releases/download/v0.0/'
                    '003_realSR_BSRGAN_DFOWMFC_s64w8_SwinIR-L_x4_GAN.pth',
}
# HD-слой: во сколько раз он больше up.png (персонаж на главном экране — до ~1400 px на экранах ×3)
HD = 2


def model(name):
    os.makedirs(MODELS, exist_ok=True)
    path = os.path.join(MODELS, name)
    if not os.path.exists(path):
        urllib.request.urlretrieve(RELEASES[name], path)
    return path


_SR = {}


def sr(img, name, tile=384, pad=24):
    """Супер-разрешение (spandrel: Real-ESRGAN, SwinIR) на CPU по плиткам с перекрытием — без швов."""
    import torch
    from spandrel import ModelLoader
    if name not in _SR:
        _SR[name] = ModelLoader().load_from_file(model(name)).eval()
    net = _SR[name]
    s = net.scale
    h, w = img.shape[:2]
    x = torch.from_numpy(img[:, :, ::-1].astype(np.float32).transpose(2, 0, 1).copy())[None] / 255
    out = torch.zeros((1, 3, h * s, w * s))
    with torch.no_grad():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                y1, x1 = min(h, y0 + tile), min(w, x0 + tile)
                ya, xa, yb, xb = max(0, y0 - pad), max(0, x0 - pad), min(h, y1 + pad), min(w, x1 + pad)
                r = net(x[:, :, ya:yb, xa:xb])
                out[:, :, y0 * s:y1 * s, x0 * s:x1 * s] = \
                    r[:, :, (y0 - ya) * s:(y1 - ya) * s, (x0 - xa) * s:(x1 - xa) * s]
    y = out[0].clamp(0, 1).numpy().transpose(1, 2, 0)[:, :, ::-1]
    return (y * 255 + 0.5).astype(np.uint8)


def upscale(tile):
    """Плитка листа ×4 (anime 6B) — основа маски и раскладки (результат кэшируется в up.png)."""
    return sr(tile, 'esrgan.pth')


def soft_hole(hole, sigma):
    """Дыра 0/255 → вес 0…1 с мягким краем (как вклейка big-lama)."""
    inside = (hole > 127).astype(np.float32)
    return np.maximum(inside, cv2.GaussianBlur(inside, (0, 0), sigma))[..., None]


def x2(img, size, interp=cv2.INTER_CUBIC):
    return cv2.resize(img, size, interpolation=interp)


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


_LAMA = None


def lama(img, hole, max_side=1024):
    """big-lama: дорисовать дыру (hole — 0/255) по окружению; вне дыры картинка не меняется."""
    import torch
    global _LAMA
    if _LAMA is None:
        _LAMA = torch.jit.load(model('big-lama.pt'), map_location='cpu').eval()
    h, w = hole.shape
    sc = min(1.0, max_side / max(h, w))
    W, H = [(int(v * sc) + 7) // 8 * 8 for v in (w, h)]
    x = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)[:, :, ::-1].astype(np.float32) / 255
    mk = (cv2.resize(hole, (W, H), interpolation=cv2.INTER_NEAREST) > 127).astype(np.float32)
    with torch.no_grad():
        r = _LAMA(torch.from_numpy(x.transpose(2, 0, 1).copy())[None], torch.from_numpy(mk)[None, None])[0]
    r = (np.clip(r.permute(1, 2, 0).numpy(), 0, 1) * 255 + 0.5).astype(np.uint8)[:, :, ::-1]
    r = cv2.resize(r, (w, h), interpolation=cv2.INTER_CUBIC)
    inside = (hole > 127).astype(np.float32)
    soft = np.maximum(inside, cv2.GaussianBlur(inside, (0, 0), 2.5))[..., None]
    return (img * (1 - soft) + r * soft + 0.5).astype(np.uint8)


def corner_mask(h, w, r, strip=4):
    """Скруглённые верхние углы и тонкая кромка рамки карточки/плитки — их дорисовывает big-lama."""
    mk = np.zeros((h, w), np.uint8)
    mk[:strip, :] = 255
    mk[:, :strip] = 255
    mk[:, w - strip:] = 255
    for cx in (r, w - 1 - r):
        box = np.zeros((h, w), np.uint8)
        x0 = 0 if cx == r else w - r - 1
        box[: r + 1, x0: x0 + r + 1] = 255
        circle = np.zeros((h, w), np.uint8)
        cv2.circle(circle, (cx, r), r, 255, -1)
        mk |= box & ~circle
    return cv2.dilate(mk, np.ones((5, 5), np.uint8))


def push_pull(img, w):
    """Заполнить неизвестное (w=0) плавным продолжением известных цветов — пирамида «push-pull»."""
    h, wd = w.shape
    if min(h, wd) <= 4:
        m = (img * w[..., None]).sum((0, 1)) / max(float(w.sum()), 1e-6)
        return np.broadcast_to(m, img.shape).astype(np.float32)
    half = (max(1, wd // 2), max(1, h // 2))
    si = cv2.resize(img * w[..., None], half, interpolation=cv2.INTER_AREA)
    sw = cv2.resize(w, half, interpolation=cv2.INTER_AREA)
    avg = si / np.maximum(sw, 1e-6)[..., None]
    coarse = push_pull(avg, np.minimum(sw * 4, 1))
    up = cv2.resize(coarse, (wd, h), interpolation=cv2.INTER_LINEAR)
    return img * w[..., None] + up * (1 - w[..., None])


def extend(base, pads, k=1):
    """Продлить сцену за края: цвета картинки плавно продолжаются (без полос и повторов), к краю —
    темнее (там интерфейс). k — масштаб картинки относительно up.png (размытие продолжения — то же)."""
    pt, pb, pl, pr = pads
    bh, bw = base.shape[:2]
    H, W = bh + pt + pb, bw + pl + pr
    canvas = np.zeros((H, W, 3), np.float32)
    canvas[pt:pt + bh, pl:pl + bw] = base
    known = np.zeros((H, W), np.float32)
    known[pt:pt + bh, pl:pl + bw] = 1
    filled = push_pull(canvas, known)
    filled = cv2.GaussianBlur(filled, (0, 0), 6 * k)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dy = np.maximum(np.maximum(pt - yy, yy - (pt + bh - 1)), 0) / max(1, max(pt, pb))
    dx = np.maximum(np.maximum(pl - xx, xx - (pl + bw - 1)), 0) / max(1, max(pl, pr))
    d = np.clip(np.maximum(dy, dx), 0, 1)
    # стык мягкий: картинка уходит в продолжение на 3% её размера
    seam = cv2.GaussianBlur(known, (0, 0), max(4, bw * 0.03))
    mix = np.clip(seam * 2 - 1, 0, 1)[..., None]
    out = canvas * mix + filled * (1 - mix)
    out = out * (1 - 0.4 * d[..., None])
    return np.clip(out, 0, 255).astype(np.uint8)


def cut_halo(rgba, sid):
    """Убрать из альфы светлый диск, касающийся внешнего края силуэта (внутренние светлые детали — нет)."""
    if sid not in HALO_CUTS:
        return rgba
    (fx, fy), keep = HALO_CUTS[sid]
    h, w = rgba.shape[:2]
    hsv = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_BGR2HSV)
    S, V = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    yy, xx = np.mgrid[0:h, 0:w]
    A = rgba[:, :, 3]
    pale = (V > 115) & (S < 160) & (xx > fx * w) & (yy < fy * h) & (A > 0)
    outside = cv2.dilate((A < 20).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(pale.astype(np.uint8), connectivity=4)
    cut = np.zeros_like(pale)
    for i in range(1, n):
        part = lab == i
        if st[i, 4] > 800 and (part & outside).any():
            cut |= part
    cut = cv2.dilate(cut.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    cut &= pale | ((V > 90) & (S < 170))
    a = A.copy()
    a[cut] = 0
    a = np.minimum(cv2.GaussianBlur(a, (3, 3), 0), A)
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [np.array([(x * w, y * h) for x, y in keep], np.int32)], 255)
    mask = cv2.GaussianBlur(mask, (7, 7), 0)
    a = np.maximum(a, (A.astype(int) * mask // 255).astype(np.uint8))
    out = rgba.copy()
    out[:, :, 3] = a
    return out


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
    # раскладка (голова, тело, сцена) — по маске в размере up.png, как раньше: разметка глаз не съезжает
    char = np.dstack([up, alpha])[by0:by1, bx0:bx1]

    # HD-слой ×2 (кэш hd.png): из него — персонаж, фон, картинка карточки и портрет
    hd_path = os.path.join(out, 'hd.png')
    hd_src = os.path.join(ROOT, 'assets-src', 'skins', 'hires', f'{sid}.webp') if hires else SRC
    if os.path.exists(hd_path) and os.path.getmtime(hd_path) > os.path.getmtime(hd_src):
        hd = cv2.imread(hd_path)
    else:
        # карточка уже детальная — ×2; плитка листа маленькая (~250 px) — SwinIR ×4, затем ×2
        hd = sr(card[:bottom], 'x2plus.pth') if hires else sr(sr(cv2.imread(SRC)[y0:y1, x0:x1], 'swinir-l.pth'), 'x2plus.pth')
        cv2.imwrite(hd_path, hd)
    H2, W2 = h * HD, w * HD
    assert hd.shape[:2] == (H2, W2), (sid, hd.shape, H2, W2)
    alpha_hd = x2(alpha, (W2, H2))
    cv2.imwrite(os.path.join(out, 'character.png'),
                cut_halo(np.dstack([hd, alpha_hd])[by0 * HD:by1 * HD, bx0 * HD:bx1 * HD], sid))

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

    # фон: место персонажа (с краем) и мини-превью дорисовывает big-lama — в игре это место закрыто
    # самим персонажем, видна только тонкая кромка при покачивании
    silhouette = ((m > 0.05) * 255).astype(np.uint8)
    # у карточек высокого разрешения рамка толще: срезается 18 px, ещё 8 px под ней дорисовываются
    frame = corner_mask(h, w, 64 if hires else 60, strip=26 if hires else 4)
    hole = cv2.dilate(silhouette, np.ones((2 * HOLE_GROW + 1, 2 * HOLE_GROW + 1), np.uint8)) | inset | frame
    # дорисовка — дольше всего: результат кэшируется (сбросить — удалить .work/<id>/filled.png)
    filled_path = os.path.join(out, 'filled.png')
    if os.path.exists(filled_path) and os.path.getmtime(filled_path) > os.path.getmtime(mask_path):
        filled = cv2.imread(filled_path)
    else:
        filled = lama(up, hole)
        cv2.imwrite(filled_path, filled)
    # у карточек высокого разрешения по краю — рамка со скруглёнными углами: в фон и превью она не идёт
    edge = 18 if hires else 0
    trim = lambda im: im[edge:, edge:w - edge] if edge else im
    trim_hd = lambda im: im[edge * HD:, edge * HD:W2 - edge * HD] if edge else im
    bh, bw = trim(filled).shape[:2]
    # сцена шире и выше картинки: края дорисовываются, персонаж остаётся на своём месте
    pl, pr = int(bw * SCENE_PAD['left']), int(bw * SCENE_PAD['right'])
    pt, pb = int(bh * SCENE_PAD['top']), int(bh * SCENE_PAD['bottom'])
    SH, SW = bh + pt + pb, bw + pl + pr
    # фон в HD: детали — из HD-слоя, место персонажа и рамки — дорисовка big-lama (её в игре закрывает персонаж)
    wgt = soft_hole(x2(hole, (W2, H2), cv2.INTER_NEAREST), 2.5 * HD)
    filled_hd = (hd * (1 - wgt) + x2(filled, (W2, H2)) * wgt + 0.5).astype(np.uint8)
    scene = extend(trim_hd(filled_hd), (pt * HD, pb * HD, pl * HD, pr * HD), HD)
    assert scene.shape[:2] == (SH * HD, SW * HD)
    cv2.imwrite(os.path.join(out, 'background.png'), scene)
    scene_char = [(bx0 - edge + pl) / SW, (by0 - edge + pt) / SH, cw / SW, ch / SH]

    # портрет: голова и плечи на фоне сцены
    size = int(min(ch * 0.46, cw * 1.0))
    cx, cy = bx0 + head_x * cw, by0 + head_y * ch + size * 0.14
    px0 = int(np.clip(cx - size / 2, 0, w - size)); py0 = int(np.clip(cy - size / 2, 0, h - size))
    cv2.imwrite(os.path.join(out, 'icon.png'), hd[py0 * HD:(py0 + size) * HD, px0 * HD:(px0 + size) * HD])

    meta = {
        'width': int(cw), 'height': int(ch), 'source': 'card' if hires else 'sheet',
        'head': [round(head_x, 4), round(head_y, 4)],
        'body': round(body_x, 4),
        # нижний край головы ≈ 1.9 × центр головы по высоте (по силуэтам листа)
        'headBottom': round(min(0.45, head_y * 1.9), 4),
        # сцена: пропорции и рамка персонажа в ней (доли) — в игре фон ставится так, чтобы персонаж
        # стоял точно на своём месте
        'scene': {'aspect': round(SW / SH, 4), 'char': [round(v, 5) for v in scene_char]},
    }
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'))
    print(sid, meta, flush=True)


if __name__ == '__main__':
    for i in [int(a) for a in sys.argv[1:]] or range(len(IDS)):
        build(i)
