/**
 * Смена позы персонажа в покое: медленный поворот в объёме (yaw — вокруг вертикали, pitch — назад/вперёд)
 * на сильно задемпфированных пружинах — тягуче, как у 3D-модели. Тапы эту физику не трогают: персонаж на
 * тап не двигается вовсе (реагирует только лицо). Отклонение ограничено, пружины сами успокаиваются точно
 * в цели, и цикл кадров останавливается.
 */

export interface Spring {
  x: number;
  v: number;
  /** куда тянет пружина (0 — исходная поза; для головы — точка, куда смотрит кот) */
  target: number;
  /** жёсткость и затухание */
  k: number;
  c: number;
  /** предел отклонения — сколько ни тапай, дальше не уйдёт */
  limit: number;
}

const spring = (k: number, damping: number, limit: number): Spring => ({
  x: 0,
  v: 0,
  target: 0,
  k,
  // затухание через коэффициент: c = 2·ζ·√k
  c: 2 * damping * Math.sqrt(k),
  limit,
});

const EPS_X = 0.0004;
const EPS_V = 0.002;
const STEP = 1 / 120;

function step(s: Spring, dt: number): void {
  const a = -s.k * (s.x - s.target) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  if (s.x > s.limit) {
    s.x = s.limit;
    s.v = Math.min(0, s.v);
  } else if (s.x < -s.limit) {
    s.x = -s.limit;
    s.v = Math.max(0, s.v);
  }
}

const resting = (s: Spring) =>
  Math.abs(s.x - s.target) < EPS_X * Math.max(1, s.limit) && Math.abs(s.v) < EPS_V * Math.max(1, s.limit);

export class CatMotion {
  /**
   * Объём: персонаж плавно поворачивается в перспективе (yaw — вокруг вертикали, pitch — наклон назад/вперёд).
   * Пружины мягкие и сильно задемпфированные — поворот медленный и тягучий, как у 3D-модели.
   */
  readonly yaw = spring(34, 0.9, 9);
  readonly pitch = spring(55, 0.75, 6);

  private readonly all = [this.yaw, this.pitch];

  /** Продвинуть физику на dt секунд; false — всё в покое. */
  advance(dt: number): boolean {
    let left = Math.min(Math.max(dt, 0), 1 / 20);
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      for (const s of this.all) step(s, h);
      left -= h;
    }
    let active = false;
    for (const s of this.all) {
      if (resting(s)) {
        s.x = s.target;
        s.v = 0;
      } else active = true;
    }
    return active;
  }

  get active(): boolean {
    return this.all.some((s) => !resting(s));
  }

  /** Куда плавно повернуться в объёме (градусы); 0, 0 — анфас. */
  orbitTo(yaw: number, pitch = 0): void {
    this.yaw.target = Math.max(-7, Math.min(7, yaw));
    this.pitch.target = Math.max(-3, Math.min(3, pitch));
  }

  /** Текущий поворот в объёме, градусы. */
  transforms(): { yaw: number; pitch: number } {
    return { yaw: this.yaw.x, pitch: this.pitch.x };
  }
}
