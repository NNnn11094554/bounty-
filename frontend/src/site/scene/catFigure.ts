import { Group, Mesh, PlaneGeometry, Vector3, type Camera, type ShaderMaterial, type Texture } from 'three';
import type { CatArt, SiteCat } from '../cats';
import { catMaterial, depthMaskMaterial, glowMaterial, lifeUniforms } from './shaders';
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

/** период вдоха-выдоха, с */
const BREATH_PERIOD = 3.6;

/**
 * Персонаж в сцене: резкий арт (точка опоры — ступни, по вертикали тела), отражение на полу,
 * лужа света под ним. Он живой: дышит грудью, поводит ушами, чуть поворачивает голову; от касания
 * смущается — прижимает уши, опускает и отводит голову, краснеет. Тап — мягкое сжатие пружиной.
 */
export class CatFigure {
  readonly group = new Group();
  /** покачивание и прыжок — внутри: group двигают станции */
  private pivot = new Group();
  /** деформация сетки (дыхание, уши, голова, румянец) — общая для тела, отражения и глубины */
  private life = lifeUniforms();
  readonly material = catMaterial(this.life);
  readonly reflectionMaterial = catMaterial(this.life, true);
  private body: Mesh;
  /** глубина силуэта — рисуется до цвета */
  private depth: Mesh;
  private reflection: Mesh;
  readonly pool: Mesh;
  private squash = new Spring(170, 15);
  private tilt = new Spring(110, 12);
  private hop = new Spring(150, 14);
  /** уши: пружины подёргивания и время следующего; знак «наружу» у левого и правого уха */
  private ears = [new Spring(320, 15), new Spring(320, 15)];
  private earNext = [1 + Math.random() * 3, 2 + Math.random() * 4];
  private earOut = [1, -1];
  /** взгляд в сторону — медленная пружина, цель меняется изредка */
  private glance = new Spring(9, 5.5);
  private glanceNext = 3 + Math.random() * 4;
  /** смущение 0…1: растёт от касаний, держится и плавно проходит */
  private shy = 0;
  private shyTarget = 0;
  private shyAt = -10;
  private shySide = 1;
  private phase = Math.random() * Math.PI * 2;
  private mask: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  width = 1;
  ready = false;

  constructor(
    readonly cat: SiteCat,
    readonly height: number,
    glow: Texture,
  ) {
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
    this.pivot.add(this.depth, this.body);
    this.group.add(this.pivot, this.reflection, this.pool);
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
    // щёки — под глазами; размер пятна — по ширине глаза, круглое на экране
    const eyes = art.face.eyes;
    const size = eyes.reduce((m, e) => m + e[2], 0) / eyes.length;
    const cheek = (e: [number, number, number, number]) => [e[0], 1 - (e[1] + e[3] * 2.1)] as const;
    const [a, b] = [cheek(eyes[0]!), cheek(eyes[1] ?? eyes[0]!)];
    L.uCheeks.value.set(a[0], a[1], b[0], b[1]);
    L.uCheekSize.value.set(size * 1.15, size * 1.15 * (w / h));
  }

  /** Касание: сила 0…1 и сторона (−1 слева, 1 справа от центра). Кот смущается и мягко пружинит. */
  poke(power: number, side: number, time: number): void {
    this.squash.kick(4.2 * power);
    this.tilt.kick(-side * 1.4 * power);
    this.hop.kick(1.1 * power);
    this.shyTarget = Math.min(1, this.shyTarget + 0.42 * power);
    this.shyAt = time;
    this.shySide = side;
    for (const [i, ear] of this.ears.entries()) ear.kick(this.earOut[i]! * 3.5 * power);
    this.material.uniforms.uFlash.value = Math.min(0.18, this.material.uniforms.uFlash.value + 0.1 * power);
  }

  /** Жизнь без касаний: дыхание, подёргивание ушей, взгляд; и как проходит смущение. */
  private live(time: number, dt: number, still: boolean): void {
    const L = this.life;
    L.uBreath.value = still ? 0 : Math.sin((time / BREATH_PERIOD) * Math.PI * 2 + this.phase);
    // смущение держится секунду после касания, потом плавно проходит; само значение догоняет цель
    if (time - this.shyAt > 1.1) this.shyTarget = Math.max(0, this.shyTarget - dt * 0.45);
    this.shy += (this.shyTarget - this.shy) * (1 - Math.exp(-dt * 5));
    const shy = this.shy * this.shy * (3 - 2 * this.shy);
    for (const [i, ear] of this.ears.entries()) {
      if (!still && time > this.earNext[i]!) {
        // одно или два быстрых движения ухом, потом пауза 2.5–7 с
        ear.kick(this.earOut[i]! * (4 + Math.random() * 3));
        this.earNext[i] = time + (Math.random() < 0.25 ? 0.35 : 2.5 + Math.random() * 4.5);
      }
      ear.update(dt);
    }
    const sway = still ? 0 : Math.sin(time * 0.7 + this.phase) * 0.025;
    // смущённый кот прижимает уши — они уходят наружу и вниз
    L.uEarAngle.value.set(
      this.earOut[0]! * (this.ears[0]!.x * 0.09 + shy * 0.34 + sway),
      this.earOut[1]! * (-this.ears[1]!.x * 0.09 + shy * 0.34 + sway),
    );
    if (!still && time > this.glanceNext) {
      // взгляд в сторону — толчок скоростью, пружина плавно возвращает голову
      this.glance.kick((Math.random() - 0.5) * 0.22);
      this.glanceNext = time + 3 + Math.random() * 5;
    }
    this.glance.update(dt);
    const idle = still ? 0 : Math.sin(time * 0.37 + this.phase) * 0.018;
    L.uHeadTilt.value = idle + this.glance.x + shy * 0.09 * this.shySide;
    L.uHeadDrop.value = -shy * 0.022 * this.height;
    L.uBlush.value = shy;
  }

  update(time: number, dt: number, still: boolean): void {
    this.squash.update(dt);
    this.tilt.update(dt);
    this.hop.update(dt);
    this.live(time, dt, still);
    const t = still ? 0 : time;
    let rz = 0;
    let y = 0;
    switch (this.cat.idle) {
      case 'sway':
        rz = Math.sin(t * 0.55 + this.phase) * 0.008;
        break;
      case 'float':
        y = 0.05 + Math.sin(t * 0.9 + this.phase) * 0.05;
        rz = Math.sin(t * 0.5) * 0.006;
        break;
      case 'breathe':
        break;
    }
    const sx = 1 - this.shy * 0.012;
    const sy = 1 - this.shy * 0.008;
    const s = this.squash.x;
    this.pivot.scale.set(sx * (1 + s * 0.07), sy * (1 - s * 0.07), 1);
    this.pivot.rotation.z = rz + this.tilt.x * 0.04;
    this.pivot.position.y = y + Math.max(0, this.hop.x) * 0.12;
    this.reflection.scale.set(this.pivot.scale.x, -this.pivot.scale.y, 1);
    this.reflection.rotation.z = -this.pivot.rotation.z;
    this.reflection.position.y = -this.pivot.position.y;
    const flash = this.material.uniforms.uFlash;
    flash.value = Math.max(0, flash.value - dt * 1.6);
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
