import { Vector3, type PerspectiveCamera } from 'three';
import { clamp01, smoothstep, travel } from '../timeline';

/**
 * Камера: у каждой станции — кадр (что в центре внимания, откуда смотреть, сколько места должно
 * поместиться), между станциями — пролёт по дуге. Кадр подстраивается под экран: на телефоне
 * (портрет) камера отходит дальше, объект смещается, чтобы освободить место интерфейсу.
 */
export interface Shot {
  /** куда смотрит камера */
  target: Vector3;
  /** откуда (направление от цели к камере) */
  dir: Vector3;
  /** что должно поместиться в кадр: ширина и высота в единицах сцены — на широком экране и на телефоне */
  fit: [number, number];
  fitPortrait: [number, number];
  /** смещение объекта на экране (доли экрана: x вправо, y вверх) — место для интерфейса */
  shift: [number, number];
  shiftPortrait: [number, number];
}

/** Пролёт между станциями: подъём или уход в сторону посередине пути (единицы сцены). */
export interface Leg {
  arc: Vector3;
}

export interface CameraState {
  position: Vector3;
  target: Vector3;
  shiftX: number;
  shiftY: number;
  fov: number;
}

const FOV_WIDE = 38;
const FOV_PORTRAIT = 50;

/** 0 — портрет (телефон), 1 — широкий экран. */
export function landscapeness(aspect: number): number {
  return smoothstep(0.72, 1.2, aspect);
}

function shotState(shot: Shot, aspect: number, out: CameraState): CameraState {
  const l = landscapeness(aspect);
  const fov = FOV_PORTRAIT + (FOV_WIDE - FOV_PORTRAIT) * l;
  const fitW = shot.fitPortrait[0] + (shot.fit[0] - shot.fitPortrait[0]) * l;
  const fitH = shot.fitPortrait[1] + (shot.fit[1] - shot.fitPortrait[1]) * l;
  const tan = Math.tan(((fov / 2) * Math.PI) / 180);
  const dist = Math.max(fitH / 2 / tan, fitW / 2 / (tan * aspect));
  out.target.copy(shot.target);
  out.position.copy(shot.dir).normalize().multiplyScalar(dist).add(shot.target);
  out.shiftX = shot.shiftPortrait[0] + (shot.shift[0] - shot.shiftPortrait[0]) * l;
  out.shiftY = shot.shiftPortrait[1] + (shot.shift[1] - shot.shiftPortrait[1]) * l;
  out.fov = fov;
  return out;
}

const blank = (): CameraState => ({
  position: new Vector3(),
  target: new Vector3(),
  shiftX: 0,
  shiftY: 0,
  fov: FOV_WIDE,
});

const bezier = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, t: number, out: Vector3) => {
  const u = 1 - t;
  return out
    .copy(a)
    .multiplyScalar(u * u * u)
    .addScaledVector(b, 3 * u * u * t)
    .addScaledVector(c, 3 * u * t * t)
    .addScaledVector(d, t * t * t);
};

export class Rig {
  private a = blank();
  private b = blank();
  private c0 = new Vector3();
  private c1 = new Vector3();
  private ahead = new Vector3();
  private tmp = new Vector3();
  readonly state = blank();
  /** насколько камера сейчас в пути (0 — на станции, 1 — середина перелёта) */
  inFlight = 0;

  constructor(
    private shots: readonly Shot[],
    private legs: readonly Leg[],
  ) {}

  /** Положение камеры для позиции на таймлайне (в станциях). */
  solve(pos: number, aspect: number): CameraState {
    const last = this.shots.length - 1;
    const i = Math.min(last - 1, Math.max(0, Math.floor(pos)));
    const f = clamp01(pos - i);
    const e = travel(f);
    shotState(this.shots[i]!, aspect, this.a);
    shotState(this.shots[i + 1]!, aspect, this.b);
    const arc = this.legs[i]!.arc;
    const pa = this.a.position;
    const pb = this.b.position;
    this.c0.lerpVectors(pa, pb, 0.3).add(arc);
    this.c1.lerpVectors(pa, pb, 0.7).add(arc);
    const s = this.state;
    bezier(pa, this.c0, this.c1, pb, e, s.position);
    // посреди пути камера смотрит вперёд по дуге — ощущение полёта сквозь пространство
    bezier(pa, this.c0, this.c1, pb, Math.min(1, e + 0.16), this.ahead);
    this.ahead.sub(s.position).normalize().multiplyScalar(12).add(s.position);
    const look = smoothstep(0, 1, e);
    s.target.lerpVectors(this.a.target, this.b.target, look);
    this.inFlight = Math.sin(Math.PI * e);
    s.target.lerp(this.ahead, this.inFlight ** 1.5 * 0.75);
    // у станции камера чуть подаётся вперёд вслед за прокруткой: сцена не замирает
    const nudge = Math.sin(2 * Math.PI * f) * 0.5 * (1 - this.inFlight);
    this.tmp.subVectors(s.target, s.position).normalize();
    s.position.addScaledVector(this.tmp, nudge);
    s.shiftX = this.a.shiftX + (this.b.shiftX - this.a.shiftX) * look;
    s.shiftY = this.a.shiftY + (this.b.shiftY - this.a.shiftY) * look;
    s.fov = this.a.fov + (this.b.fov - this.a.fov) * look;
    return s;
  }
}

/** Применить к камере: положение, взгляд и смещение кадра (setViewOffset — без искажения перспективы). */
export function applyCamera(
  camera: PerspectiveCamera,
  s: CameraState,
  offset: Vector3,
  width: number,
  height: number,
  roll: number,
): void {
  camera.position.copy(s.position).add(offset);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(s.target.x + offset.x * 0.4, s.target.y + offset.y * 0.4, s.target.z);
  if (Math.abs(camera.fov - s.fov) > 1e-3) camera.fov = s.fov;
  camera.setViewOffset(width, height, -s.shiftX * width, s.shiftY * height, width, height);
}
