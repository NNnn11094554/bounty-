/**
 * Физика реакции кота на тапы: несколько затухающих пружин (сжатие корпуса, наклон, голова, хвост, ухо, кроссовка).
 * Тап не запускает отдельную анимацию, а добавляет пружине скорость — поэтому быстрые тапы не спорят
 * друг с другом, не копят смещение и не дёргают кота: отклонение ограничено, а после серии пружины
 * сами возвращаются точно в исходное положение (и цикл кадров останавливается).
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
  /** сжатие корпуса: −0.02 → scaleY 0.98 */
  readonly squash = spring(500, 0.28, 0.035);
  /** наклон корпуса, градусы */
  readonly tilt = spring(180, 0.45, 2);
  /** наклон головы, градусы */
  readonly head = spring(140, 0.55, 5);
  /** поворот головы в сторону взгляда, % ширины */
  readonly look = spring(90, 0.7, 2);
  /** взмах хвоста поверх его спокойного покачивания, градусы */
  readonly tail = spring(120, 0.25, 10);
  /** подёргивание уха, градусы (быстрое и живое) */
  readonly ear = spring(420, 0.3, 12);
  /** притоп: подъём пятки, градусы (только вверх — ниже пола кроссовка не уходит) */
  readonly foot = spring(260, 0.5, 6);
  /**
   * Объём: кот плавно поворачивается в перспективе (yaw — вокруг вертикали, pitch — наклон назад/вперёд).
   * Пружины мягкие и сильно задемпфированные — поворот медленный и тягучий, как у 3D-модели.
   */
  readonly yaw = spring(34, 0.9, 9);
  readonly pitch = spring(55, 0.75, 6);

  private readonly all = [
    this.squash,
    this.tilt,
    this.head,
    this.look,
    this.tail,
    this.ear,
    this.foot,
    this.yaw,
    this.pitch,
  ];

  /** Продвинуть физику на dt секунд; false — всё в покое. */
  advance(dt: number): boolean {
    let left = Math.min(Math.max(dt, 0), 1 / 20);
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      for (const s of this.all) step(s, h);
      left -= h;
    }
    // пол: пятка не проваливается ниже исходного положения
    if (this.foot.x < 0) {
      this.foot.x = 0;
      this.foot.v = Math.max(0, this.foot.v);
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

  /** Тап: сила 1…1.5 (серия), side −1…1 — с какой стороны тапнули, onHead — тап по голове. */
  tap(strength: number, side: number, onHead: boolean): void {
    this.squash.v -= (onHead ? 0.3 : 0.45) * strength;
    this.tilt.v += side * 10 * strength;
    this.head.v += (onHead ? 22 : 9) * (side >= 0 ? 1 : -1) * strength;
    this.tail.v += 40 * strength;
    if (onHead) this.ear.v -= 160 * strength;
    // в объёме: тап мягко откидывает кота назад и чуть разворачивает от пальца
    this.pitch.v += 26 * strength;
    this.yaw.v += side * 30 * strength;
  }

  /** Куда плавно повернуться в объёме (градусы); 0, 0 — анфас. */
  orbitTo(yaw: number, pitch = 0): void {
    this.yaw.target = Math.max(-7, Math.min(7, yaw));
    this.pitch.target = Math.max(-3, Math.min(3, pitch));
  }

  /** Ухо дёрнулось: dir −1 назад, 1 вперёд. */
  twitch(dir = -1, power = 1): void {
    this.ear.v += 190 * dir * power;
  }

  /** Притоп кроссовкой: пятка поднимается и опускается. */
  stomp(power = 1): void {
    this.foot.v += 70 * power;
  }

  /** Голова смотрит в сторону: rot — градусы, shift — % ширины. */
  lookAt(rot: number, shift: number): void {
    this.head.target = Math.max(-3, Math.min(3, rot));
    this.look.target = Math.max(-1.4, Math.min(1.4, shift));
  }

  /** Встряхнуть голову (кивок, удивление): imp — градусы в секунду. */
  nod(imp: number): void {
    this.head.v += imp;
  }

  swish(imp: number): void {
    this.tail.v += imp;
  }

  /** Трансформации слоёв; пустая строка — исходное положение без transform. */
  transforms(): {
    body: string;
    head: string;
    tail: string;
    ear: string;
    foot: string;
    yaw: number;
    pitch: number;
  } {
    const q = this.squash.x;
    const body =
      Math.abs(q) < 1e-5 && Math.abs(this.tilt.x) < 1e-4
        ? ''
        : `scale(${(1 - q * 0.45).toFixed(5)}, ${(1 + q).toFixed(5)}) rotate(${this.tilt.x.toFixed(3)}deg)`;
    const head =
      Math.abs(this.head.x) < 1e-4 && Math.abs(this.look.x) < 1e-4
        ? ''
        : `translate3d(${this.look.x.toFixed(3)}%, 0, 0) rotate(${this.head.x.toFixed(3)}deg)`;
    const rot = (s: Spring) => (Math.abs(s.x) < 1e-4 ? '' : `rotate(${s.x.toFixed(3)}deg)`);
    return {
      body,
      head,
      tail: rot(this.tail),
      ear: rot(this.ear),
      foot: rot(this.foot),
      yaw: this.yaw.x,
      pitch: this.pitch.x,
    };
  }
}
