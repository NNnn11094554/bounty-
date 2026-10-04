"""
Лицо персонажей для «живого» кота: глаза (взгляд по сторонам) и область головы (наклон головы).
Глаза размечены вручную по увеличенным кропам и проверены оверлеями (эллипсы в долях картинки персонажа:
x, rx — от ширины, y, ry — от высоты). Скрипт добавляет к skinArt.json поле face:
  eyes  — [[x, y, rx, ry], …] (обычно два глаза; у персонажей в маске/капюшоне виден один);
  head  — эллипс головы [x, y, rx, ry] (от макушки с ушами/короной до подбородка, глаза — целиком внутри)
          — слой наклона головы;
  neck  — точка поворота головы [x, y].
Запуск: python3 scripts/skins/face.py (после build.mjs; картинки — public/assets/skins/<id>/character-1600.webp).
`python3 scripts/skins/face.py site` — то же для котов сайта (src/site/catArt.json) плюс уши (EARS).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'src' / 'game' / 'skinArt.json'

EYES = {
    'angel_guardian': [[0.6922, 0.2581, 0.0486, 0.0356], [0.8486, 0.3003, 0.0272, 0.0302]],
    'arctic_king': [[0.6239, 0.2685, 0.0501, 0.035], [0.7879, 0.3061, 0.03, 0.026]],
    'astro_cat': [[0.5061, 0.2877, 0.052, 0.0448], [0.7232, 0.3258, 0.0416, 0.0345]],
    'crystal_prince': [[0.6195, 0.2568, 0.0524, 0.0336], [0.8015, 0.3019, 0.0415, 0.0228]],
    'cyber_samurai': [[0.6016, 0.2518, 0.0468, 0.0306], [0.7939, 0.2968, 0.0346, 0.0216]],
    'dark_reaper': [[0.6904, 0.269, 0.0523, 0.0381]],
    'desert_nomad': [[0.6584, 0.2645, 0.0382, 0.0322], [0.8085, 0.2989, 0.0303, 0.0246]],
    'forest_spirit': [[0.5836, 0.2613, 0.0403, 0.0366], [0.7389, 0.309, 0.0326, 0.0312]],
    'galaxy_emperor': [[0.6166, 0.2667, 0.0459, 0.0291], [0.8043, 0.3115, 0.0351, 0.0224]],
    'inferno': [[0.6679, 0.2734, 0.0376, 0.0306], [0.8365, 0.3183, 0.0264, 0.0261]],
    'lunar_witch': [[0.4994, 0.3037, 0.0323, 0.0341], [0.6186, 0.3324, 0.0241, 0.03]],
    'mecha': [[0.705, 0.2588, 0.0433, 0.0365]],
    'neon_punk': [[0.6424, 0.268, 0.0417, 0.0303], [0.8149, 0.3055, 0.0348, 0.0259]],
    'ocean_guardian': [[0.5177, 0.2475, 0.0339, 0.0315], [0.6474, 0.2813, 0.0232, 0.0248]],
    'royal_emperor': [[0.4453, 0.2985, 0.0358, 0.0323], [0.5784, 0.3353, 0.0307, 0.0269]],
    'sakura_blossom': [[0.5946, 0.292, 0.0448, 0.0322], [0.7609, 0.3277, 0.0352, 0.03]],
    'shadow_drifter': [[0.6114, 0.26, 0.046, 0.0304], [0.7968, 0.3016, 0.0362, 0.0224]],
    'stealth_assassin': [[0.672, 0.2702, 0.0404, 0.0299], [0.8299, 0.3157, 0.0301, 0.0268]],
    'toxic': [[0.6824, 0.2735, 0.041, 0.0367], [0.8462, 0.3138, 0.041, 0.0304]],
    'vampire_lord': [[0.563, 0.2781, 0.0343, 0.0337], [0.6942, 0.3186, 0.0279, 0.0292]],
}


def face_for(alpha, a, eyes):
    """Эллипс головы и шея по силуэту и глазам (доли картинки)."""
    H, W = alpha.shape
    hx, hb = a['head'][0], a['headBottom']
    cols = slice(max(0, int((hx - 0.3) * W)), min(W, int((hx + 0.3) * W)))
    rows = np.where((alpha[: int(hb * H), cols] > 128).any(axis=1))[0]
    top = rows[0] / H if len(rows) else 0
    ry = (hb - top) / 2 * 1.06
    cy = (top + hb) / 2
    # глаза целиком — в непрозрачной части головы (до 75% эллипса), иначе при наклоне край глаза
    # смешался бы с неподвижной копией в теле
    for _, y, _, ey in eyes:
        ry = max(ry, (abs(y - cy) + ey) / 0.7)
    # персонажи в три четверти: лицо смещено от центра головы — эллипс сдвигается к глазам
    eyes_mid = (min(x - ex for x, _, ex, _ in eyes) + max(x + ex for x, _, ex, _ in eyes)) / 2
    cx = (hx + eyes_mid) / 2
    rx_px = ry * H * 0.95
    for x, y, ex, _ in eyes:
        dy = min(0.7, abs(y - cy) / ry)
        rx_px = max(rx_px, (abs(x - cx) + ex) * W / (0.75**2 - dy**2) ** 0.5)
    return {
        'eyes': eyes,
        'head': [round(cx, 4), round(cy, 4), round(rx_px / W, 4), round(ry, 4)],
        'neck': [round(hx, 4), round(hb, 4)],
    }


# уши котов сайта: [кончик x, y, основание x, y] в долях картинки персонажа — размечены вручную по сетке
# (как глаза); у Лунной ведьмы уши под шляпой — не двигаются
EARS = {
    'inferno': [[0.62, 0.01, 0.6, 0.12], [0.98, 0.146, 0.905, 0.217]],
    'sakura_blossom': [[0.52, 0.023, 0.484, 0.16], [0.915, 0.143, 0.85, 0.21]],
    'toxic': [[0.584, 0.014, 0.58, 0.15], [0.955, 0.154, 0.89, 0.2]],
    'desert_nomad': [[0.54, 0.009, 0.58, 0.103], [0.937, 0.12, 0.89, 0.16]],
    'crystal_prince': [[0.424, 0.009, 0.44, 0.109], [0.83, 0.12, 0.775, 0.166]],
    'lunar_witch': [],
    'stealth_assassin': [[0.57, 0.02, 0.56, 0.125], [0.98, 0.133, 0.91, 0.21]],
    'galaxy_emperor': [[0.53, 0.02, 0.54, 0.14], [0.97, 0.14, 0.88, 0.22]],
    'ocean_guardian': [[0.43, 0.015, 0.46, 0.14], [0.7, 0.14, 0.66, 0.22]],
    'cyber_samurai': [[0.44, 0.015, 0.46, 0.13], [0.91, 0.14, 0.83, 0.22]],
}

# хвосты котов сайта: [основание x, y, кончик x, y] в долях картинки — размечены вручную по сетке
TAILS = {
    'inferno': [0.39, 0.7, 0.09, 0.73],
    'sakura_blossom': [0.42, 0.55, 0.13, 0.35],
    'toxic': [0.41, 0.6, 0.08, 0.42],
    'desert_nomad': [0.34, 0.5, 0.07, 0.6],
    'crystal_prince': [0.26, 0.68, 0.05, 0.65],
    'lunar_witch': [0.33, 0.67, 0.14, 0.53],
    'stealth_assassin': [0.3, 0.69, 0.06, 0.62],
    # хвоста не видно — так же медленно ведёт край плаща
    'galaxy_emperor': [0.28, 0.62, 0.1, 0.58],
    'ocean_guardian': [0.27, 0.83, 0.03, 0.77],
    'cyber_samurai': [0.28, 0.62, 0.05, 0.64],
}


def main_site():
    """Сайт игры: лицо и уши котов сайта в src/site/catArt.json (картинки — public/assets/site/cats)."""
    path = ROOT / 'src' / 'site' / 'catArt.json'
    art = json.loads(path.read_text())
    for cat, a in art.items():
        im = np.asarray(
            Image.open(ROOT / 'public' / 'assets' / 'site' / 'cats' / cat / 'character-1600.webp').convert('RGBA')
        )
        alpha = im[..., 3]
        # нижний край головы ≈ 1.9 × центр головы по высоте (как в compose.py)
        a['headBottom'] = round(min(0.45, a['head'][1] * 1.9), 4)
        face = face_for(alpha, a, EYES[cat])
        face['ears'] = EARS[cat]
        face['tail'] = TAILS.get(cat)
        a['face'] = face
    path.write_text(json.dumps(art, indent=2, ensure_ascii=False) + '\n')
    print(f'face: {len(art)} site cats')


def main():
    art = json.loads(ART.read_text())
    for skin, eyes in EYES.items():
        if skin not in art:  # персонаж убран из коллекции (разметка — под его прежний арт)
            continue
        im = np.asarray(Image.open(ROOT / 'public' / 'assets' / 'skins' / skin / 'character-1600.webp').convert('RGBA'))
        art[skin]['face'] = face_for(im[..., 3], art[skin], eyes)
    ART.write_text(json.dumps(art, indent=2, ensure_ascii=False) + '\n')
    print(f'face: {len([s for s in EYES if s in art])} skins')


if __name__ == '__main__':
    import sys

    main_site() if 'site' in sys.argv[1:] else main()
