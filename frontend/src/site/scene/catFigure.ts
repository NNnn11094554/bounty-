import type { Color } from 'three';
import { Group, Mesh, PlaneGeometry, Vector3, type Camera, type ShaderMaterial, type Texture } from 'three';
import type { CatArt, SiteCat } from '../cats';
import { catMaterial, depthMaskMaterial, glowMaterial, lifeUniforms, shadowMaterial } from './shaders';
import { makeCanvas } from './textures';

/** Пружина: x тянется к 0, v — скорость (реакция на тап с лёгким перелётом, без наложения анимаций). */
class Spring {
  x = 0;
  v = 0;
  constructor(
    private k: number,
    private c: number,
  ) {}
  kick(v: number) {
    this.v += v;
  }
  update(dt: number) {
    // несколько шагов — устойчиво при любом dt
    const n = Math.ceil(dt / (1 / 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (-this.k * this.x - this.c * this.v) * h;
      this.x += this.v * h;
    }
  }
}

/**
 * Медленное блуждание: цель меняется в случайные моменты, значение догоняет её пружиной с критическим
 * затуханием — плавно, без перелёта и без повторяющегося цикла.
 */
class Drift {
  x = 0;
  private v = 0;
  private target = 0;
  private next: number;
  constructor(
    /** амплитуда */
    private amp: number,
    /** паузы между сменами цели, с */
    private gap: [number, number],
    /** собственная частота, рад/с: чем меньше, тем медленнее */
    private omega: number,
    /** доля смен, когда цель — покой (0) */
    private rest = 0.35,
  ) {
    this.next = Math.random() * gap[1];
  }
  update(time: number, dt: number): number {
    if (this.amp && time > this.next) {
      this.target = Math.random() < this.rest ? 0 : (Math.random() * 2 - 1) * this.amp;
      this.next = time + this.gap[0] + Math.random() * (this.gap[1] - this.gap[0]);
    }
    const n = Math.ceil(dt / (1 / 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.omega * this.omega * (this.target - this.x) - 2 * this.omega * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/** Моргание: закрыть — 70 мс, закрыто — 30 мс, открыть — 90 мс. */
function blinkCurve(t: number): number {
  if (t < 0 || t > 0.19) return 0;
  if (t < 0.07) return t / 0.07;
  if (t < 0.1) return 1;
  const k = (t - 0.1) / 0.09;
  return 1 - k * k * (3 - 2 * k);
}

/**
 * Персонаж в сцене: резкий арт (точка опоры — ступни, по вертикали тела), контактная тень, отражение
 * на полу и свет мира. Он живёт сам по себе (cat.idle): дышит, моргает, ведёт хвостом, поводит ушами,
 * чуть поворачивает голову, переносит вес — медленно, мелко и в случайные моменты. На тапы не реагирует:
 * тап — игровая механика, персонажа он не дёргает.
 */
export class CatFigure {
  readonly group = new Group();
  /** покачивание и прыжок — внутри: group двигают станции */
  private pivot = new Group();
  /** деформация сетки (дыхание, уши, голова) — общая для тела, отражения и глубины */
  private life = lifeUniforms();
  readonly material = catMaterial(this.life);
  readonly reflectionMaterial = catMaterial(this.life, true);
  private body: Mesh;
  /** глубина силуэта — рисуется до цвета */
  private depth: Mesh;
  private reflection: Mesh;
  readonly pool: Mesh;
  /** мягкая контактная тень у лап */
  readonly shadow: Mesh;
  /** уши: пружины подёргивания и время следующего; знак «наружу» у левого и правого уха */
  private ears = [new Spring(150, 12), new Spring(150, 12)];
  private earNext = [2 + Math.random() * 4, 3 + Math.random() * 6];
  private earOut = [1, -1];
  private breathPhase = Math.random() * Math.PI * 2;
  /** темп дыхания и его глубина чуть плавают — дыхание не механическое */
  private breathRate: Drift;
  private nextBlink: number;
  private blinkAt = -10;
  private tail: Drift;
  private head: Drift;
  private shoulders: Drift;
  /** перенос веса: еле заметный наклон корпуса от ступней */
  private weight = new Drift(0.005, [5, 12], 0.9, 0.3);
  private mask: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  width = 1;
  ready = false;

  constructor(
    readonly cat: SiteCat,
    readonly height: number,
    glow: Texture,
  ) {
    const idle = cat.idle;
    this.breathRate = new Drift(0.18, [3, 8], 0.8, 0.2);
    this.tail = new Drift(0.075 * idle.tail, [1.6, 5.5], 1.6, 0.25);
    this.head = new Drift(0.055 * idle.head, [3, 9], 1.3, 0.45);
    this.shoulders = new Drift(0.012 * idle.shoulders * height, [4, 11], 1.8, 0.6);
    this.nextBlink = 1.5 + Math.random() * idle.blinkEvery;
    const geometry = new PlaneGeometry(1, 1);
    this.body = new Mesh(geometry, this.material);
    this.depth = new Mesh(geometry, depthMaskMaterial(this.life));
    this.reflection = new Mesh(geometry, this.reflectionMaterial);
    this.reflection.scale.y = -1;
    this.body.visible = this.reflection.visible = this.depth.visible = false;
    this.depth.renderOrder = 9;
    this.body.renderOrder = 10;
    this.reflection.renderOrder = 5;
    this.pool = new Mesh(new PlaneGeometry(1, 1), glowMaterial(glow, cat.accent, 0.55));
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.scale.set(height * 1.25, height * 0.62, 1);
    this.pool.position.y = 0.01;
    this.pool.renderOrder = 4;
    this.shadow = new Mesh(new PlaneGeometry(1, 1), shadowMaterial(glow));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.shadow.renderOrder = 4.5;
    this.pivot.add(this.depth, this.body);
    this.group.add(this.pivot, this.reflection, this.pool, this.shadow);
    this.material.uniforms.uRim.value.set(cat.accent2);
    this.material.uniforms.uEdge.value.set(cat.accent2);
    this.reflectionMaterial.uniforms.uRimStrength.value = 0;
  }

  setTexture(texture: Texture, art: CatArt): void {
    const w = this.height * art.aspect;
    this.width = w;
    const h = this.height;
    // сетка частая: уши, голова и грудь гнутся плавно, без изломов
    const geometry = new PlaneGeometry(w, h, 30, 44);
    // точка опоры — ступни на вертикали тела
    geometry.translate(w * (0.5 - art.body), h / 2, 0);
    this.setLife(art, w, h);
    this.body.geometry.dispose();
    this.body.geometry = geometry;
    this.depth.geometry = geometry;
    this.reflection.geometry = geometry;
    this.material.uniforms.map.value = texture;
    this.reflectionMaterial.uniforms.map.value = texture;
    const img = texture.image as HTMLImageElement;
    this.material.uniforms.uTexel.value.set(1 / img.naturalWidth, 1 / img.naturalHeight);
    (this.depth.material as ShaderMaterial).uniforms.map!.value = texture;
    this.body.visible = this.reflection.visible = true;
    this.mask = alphaMask(texture.image as HTMLImageElement);
    this.ready = true;
    this.depth.visible = this.material.uniforms.uReveal.value >= 0.999;
  }

  /** проявление 0…1 (вступление и смена кота) */
  set reveal(v: number) {
    this.material.uniforms.uReveal.value = v;
    this.reflectionMaterial.uniforms.uReveal.value = v;
    // пока кот проявляется, его невидимые части не должны закрывать частицы
    this.depth.visible = this.ready && v >= 0.999;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
    this.reflectionMaterial.uniforms.uOpacity.value = v;
    (this.pool.material as typeof this.material).uniforms.uOpacity.value = 0.55 * v;
    (this.shadow.material as ShaderMaterial).uniforms.uOpacity!.value = v;
  }

  /** яркость (коты в глубине коллекции темнее) */
  set dim(v: number) {
    this.material.uniforms.uDim.value = v;
    this.reflectionMaterial.uniforms.uDim.value = v;
  }

  /** Лицо и уши из разметки (доли картинки) → координаты сетки (от ступней, единицы сцены). */
  private setLife(art: CatArt, w: number, h: number): void {
    const L = this.life;
    const qx = (fx: number) => (fx - art.body) * w;
    const qy = (fy: number) => (1 - fy) * h;
    L.uHeight.value = h;
    const [e0, e1] = art.face.ears;
    if (e0) L.uEar0.value.set(qx(e0[0]), qy(e0[1]), qx(e0[2]), qy(e0[3]));
    if (e1) L.uEar1.value.set(qx(e1[0]), qy(e1[1]), qx(e1[2]), qy(e1[3]));
    this.earOut = [e0 ? 1 : 0, e1 ? -1 : 0];
    const [cx, cy, rx, ry] = art.face.head;
    L.uHead.value.set(qx(cx), qy(cy), rx * w, ry * h);
    L.uNeck.value.set(qx(art.face.neck[0]), qy(art.face.neck[1]));
    const tail = art.face.tail;
    if (tail) L.uTail.value.set(qx(tail[2]), qy(tail[3]), qx(tail[0]), qy(tail[1]));
    // глаза для моргания — в координатах текстуры (y снизу), с запасом на ресницы
    const eyes = art.face.eyes;
    const eye = (e: [number, number, number, number] | undefined) =>
      e ? ([e[0], 1 - e[1], e[2] * 1.5, e[3] * 1.6] as const) : ([-1, -1, 0.001, 0.001] as const);
    L.uEye0.value.set(...eye(eyes[0]));
    L.uEye1.value.set(...eye(eyes[1]));
    // контактная тень — по ширине тела у лап
    this.shadow.scale.set(w * 0.62, h * 0.12, 1);
  }

  /** Жизнь: каждое движение — своё, в случайные моменты, по профилю кота (у котов разный набор). */
  private live(time: number, dt: number, still: boolean): void {
    const L = this.life;
    const idle = this.cat.idle;
    if (still) {
      L.uBreath.value = 0;
      L.uBlink.value = 0;
      return;
    }
    // дыхание: темп и глубина медленно плавают
    const rate = 1 + this.breathRate.update(time, dt);
    this.breathPhase += ((dt * Math.PI * 2) / idle.breathPeriod) * rate;
    L.uBreath.value = Math.sin(this.breathPhase) * idle.breath * (0.85 + rate * 0.15);
    // моргание: редко, иногда дважды подряд
    if (idle.blinkEvery && time > this.nextBlink) {
      this.blinkAt = time;
      const double = Math.random() < 0.18;
      this.nextBlink = time + (double ? 0.32 : idle.blinkEvery * (0.55 + Math.random() * 0.9));
    }
    L.uBlink.value = blinkCurve(time - this.blinkAt);
    // уши: короткое движение в случайный момент
    for (const [i, ear] of this.ears.entries()) {
      if (idle.ears && time > this.earNext[i]!) {
        ear.kick(this.earOut[i]! * (2 + Math.random() * 2));
        this.earNext[i] = time + (Math.random() < 0.2 ? 0.4 : (3 + Math.random() * 7) / idle.ears);
      }
      ear.update(dt);
    }
    L.uEarAngle.value.set(
      this.earOut[0]! * this.ears[0]!.x * 0.08,
      this.earOut[1]! * -this.ears[1]!.x * 0.08,
    );
    L.uTailAngle.value = this.tail.update(time, dt);
    L.uHeadTilt.value = this.head.update(time, dt);
    L.uShoulder.value = Math.max(0, this.shoulders.update(time, dt));
  }

  update(time: number, dt: number, still: boolean): void {
    this.live(time, dt, still);
    const rz = still ? 0 : this.weight.update(time, dt);
    this.pivot.rotation.z = rz;
    this.reflection.rotation.z = -rz;
  }

  /** окружение: цвет света снизу (пол, мир) — им подсвечивается низ персонажа */
  setAmbient(color: Color, strength: number): void {
    this.material.uniforms.uAmbient.value.copy(color);
    this.material.uniforms.uAmbientStrength.value = strength;
  }

  /** Точка экрана (NDC −1…1) попадает в силуэт? world — куда пришёлся тап (на плоскости кота). */
  hit(ndcX: number, ndcY: number, camera: Camera, world: Vector3): boolean {
    if (!this.mask) return false;
    this.group.updateWorldMatrix(true, false);
    const origin = new Vector3().setFromMatrixPosition(this.group.matrixWorld);
    // плоскость кота перпендикулярна оси z группы: луч из камеры до неё
    const ray = new Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    const normal = new Vector3(0, 0, 1).transformDirection(this.group.matrixWorld);
    const denom = ray.dot(normal);
    if (Math.abs(denom) < 1e-4) return false;
    const t = origin.clone().sub(camera.position).dot(normal) / denom;
    if (t <= 0) return false;
    world.copy(camera.position).addScaledVector(ray, t);
    const local = this.group.worldToLocal(world.clone());
    const art =
      this.body.geometry.boundingBox ??
      (this.body.geometry.computeBoundingBox(), this.body.geometry.boundingBox!);
    const u = (local.x - art.min.x) / (art.max.x - art.min.x);
    const v = 1 - (local.y - art.min.y) / (art.max.y - art.min.y);
    if (u < 0 || u > 1 || v < 0 || v > 1) return false;
    const { data, w, h } = this.mask;
    // запас вокруг силуэта — пальцу не нужно попадать пиксель в пиксель
    for (const [dx, dy] of [
      [0, 0],
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ] as const) {
      const x = Math.min(w - 1, Math.max(0, Math.round(u * (w - 1)) + dx));
      const y = Math.min(h - 1, Math.max(0, Math.round(v * (h - 1)) + dy));
      if (data[(y * w + x) * 4 + 3]! > 60) return true;
    }
    return false;
  }

  /** Рамка тела на экране (доли −1…1 NDC): для подсказки и всплывающих наград. */
  screenBox(camera: Camera): { x0: number; y0: number; x1: number; y1: number } | null {
    if (!this.ready) return null;
    const geometry = this.body.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const b = geometry.boundingBox!;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const p = new Vector3();
    for (const x of [b.min.x, b.max.x])
      for (const y of [b.min.y, b.max.y]) {
        p.set(x, y, 0).applyMatrix4(this.body.matrixWorld).project(camera);
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y);
      }
    return { x0, y0, x1, y1 };
  }

  dispose(): void {
    this.body.geometry.dispose();
    (this.depth.material as ShaderMaterial).dispose();
    this.material.dispose();
    this.reflectionMaterial.dispose();
    this.pool.geometry.dispose();
    (this.pool.material as typeof this.material).dispose();
  }
}

/** Маска силуэта для попадания тапом: альфа картинки в низком разрешении. */
function alphaMask(img: HTMLImageElement): { data: Uint8ClampedArray; w: number; h: number } | null {
  const h = 160;
  const w = Math.max(1, Math.round((img.naturalWidth / img.naturalHeight) * h));
  try {
    const [, ctx] = makeCanvas(w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  } catch {
    return null;
  }
}
