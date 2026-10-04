import { Group, Mesh, PlaneGeometry, Vector3, type Camera, type ShaderMaterial, type Texture } from 'three';
import type { CatArt, SiteCat } from '../cats';
import { catMaterial, depthMaskMaterial, glowMaterial } from './shaders';
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
 * Персонаж в сцене: резкий арт (точка опоры — ступни, по вертикали тела), отражение на полу,
 * лужа света под ним. Спокойная анимация — от ступней; тап — сжатие и растяжение пружиной.
 */
export class CatFigure {
  readonly group = new Group();
  /** покачивание и прыжок — внутри: group двигают станции */
  private pivot = new Group();
  readonly material = catMaterial();
  readonly reflectionMaterial = catMaterial(true);
  private body: Mesh;
  /** глубина силуэта — рисуется до цвета */
  private depth: Mesh;
  private reflection: Mesh;
  readonly pool: Mesh;
  private squash = new Spring(210, 13);
  private tilt = new Spring(120, 9);
  private hop = new Spring(160, 11);
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
    this.depth = new Mesh(geometry, depthMaskMaterial());
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
    const geometry = new PlaneGeometry(w, this.height);
    // точка опоры — ступни на вертикали тела
    geometry.translate(w * (0.5 - art.body), this.height / 2, 0);
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

  /** Реакция на тап: сила 0…1 и сторона (−1 слева, 1 справа от центра). */
  poke(power: number, side: number): void {
    this.squash.kick(7 * power);
    this.tilt.kick(-side * 2.2 * power);
    this.hop.kick(1.6 * power);
    this.material.uniforms.uFlash.value = Math.min(0.35, this.material.uniforms.uFlash.value + 0.22 * power);
  }

  update(time: number, dt: number, still: boolean): void {
    this.squash.update(dt);
    this.tilt.update(dt);
    this.hop.update(dt);
    const t = still ? 0 : time;
    let sx = 1;
    let sy = 1;
    let rz = 0;
    let y = 0;
    switch (this.cat.idle) {
      case 'sway':
        rz = Math.sin(t * 0.85) * 0.011;
        sy = 1 + Math.sin(t * 1.7) * 0.006;
        break;
      case 'float':
        y = 0.05 + Math.sin(t * 1.05) * 0.055;
        rz = Math.sin(t * 0.6) * 0.008;
        break;
      case 'breathe':
        sy = 1 + Math.sin(t * 1.5) * 0.009;
        sx = 1 - Math.sin(t * 1.5) * 0.004;
        break;
    }
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
