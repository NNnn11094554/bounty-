import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineSegments,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { additive, FOG, globals } from './shaders';

/**
 * Частицы: всё движение — в вершинном шейдере от времени (процессор каждый кадр ничего не пересчитывает).
 * Исключение — всплески от тапа: маленький пул, обновляется только пока он виден.
 */

/** Пикселей на единицу размера на расстоянии 1 — от высоты буфера и угла обзора (обновляет сцена). */
export const pointScale = { value: 600 };

const rand = (seed: number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const SOFT_POINT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = dot(q, q) * 4.0;
  if (d > 1.0) discard;
  float a = exp(-d * 3.6) - 0.027;
  gl_FragColor = vec4(vColor * a * vAlpha, 0.0);
}
`;

export interface DustZone {
  /** центр облака */
  center: Vector3;
  /** размеры облака по x, y, z */
  size: Vector3;
  colors: readonly string[];
  /** доля всех частиц */
  share: number;
}

/**
 * Пыль во всём пространстве: медленно плывёт и мерцает; у самой камеры — крупные размытые
 * боке (глубина резкости), вдали растворяется в тумане. uTint перекрашивает облако вокруг uTintZ
 * (коллекция — в цвет выбранного кота).
 */
export function createDust(count: number, zones: readonly DustZone[], seed = 7): Points {
  const r = rand(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const total = zones.reduce((s, z) => s + z.share, 0);
  const c = new Color();
  let i = 0;
  for (const zone of zones) {
    const n = Math.round((count * zone.share) / total);
    for (let k = 0; k < n && i < count; k++, i++) {
      pos[i * 3] = zone.center.x + (r() - 0.5) * zone.size.x;
      pos[i * 3 + 1] = zone.center.y + (r() - 0.5) * zone.size.y;
      pos[i * 3 + 2] = zone.center.z + (r() - 0.5) * zone.size.z;
      for (let s = 0; s < 4; s++) seeds[i * 4 + s] = r();
      c.set(zone.colors[Math.floor(r() * zone.colors.length)]!);
      colors.set([c.r, c.g, c.b], i * 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos.subarray(0, i * 3), 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds.subarray(0, i * 4), 4));
  geometry.setAttribute('aColor', new BufferAttribute(colors.subarray(0, i * 3), 3));
  const material = additive(
    new ShaderMaterial({
      uniforms: {
        uSize: { value: 0.05 },
        uReveal: { value: 0 },
        uTint: { value: new Color('#ffffff') },
        uTintZ: { value: -1000 },
        uScale: pointScale,
        uTime: globals.uTime,
        uPixelRatio: globals.uPixelRatio,
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        attribute vec3 aColor;
        uniform float uSize;
        uniform float uReveal;
        uniform vec3 uTint;
        uniform float uTintZ;
        uniform float uScale;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        ${FOG}
        void main() {
          vec3 p = position;
          float t = uTime * (0.08 + aSeed.x * 0.16);
          p.x += sin(t + aSeed.y * 6.2831) * (0.2 + aSeed.z * 0.55);
          p.y += sin(t * 0.77 + aSeed.z * 6.2831) * (0.2 + aSeed.x * 0.45);
          p.z += cos(t * 0.6 + aSeed.w * 6.2831) * 0.35;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float depth = -mv.z;
          float near = 1.0 - smoothstep(0.8, 5.0, depth);
          float size = uSize * (0.35 + aSeed.w * aSeed.w * 1.7) * (1.0 + near * 5.0);
          gl_PointSize = clamp(size * uScale / max(depth, 0.1), 0.0, 80.0 * uPixelRatio);
          float twinkle = 0.62 + 0.38 * sin(uTime * (0.8 + aSeed.y * 2.6) + aSeed.x * 40.0);
          float tz = exp(-pow((position.z - uTintZ) / 16.0, 2.0));
          vColor = mix(aColor, uTint, tz * 0.8);
          vAlpha = (0.3 + 0.7 * aSeed.x) * twinkle * (1.0 - near * 0.82) * (1.0 - fogAmount(depth)) * uReveal;
          if (depth < 0.25) vAlpha = 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: SOFT_POINT,
    }),
  );
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/**
 * Штрихи скорости: при быстром пролёте камеры частицы вытягиваются вдоль движения (размытие
 * движения только там, где оно нужно), в покое их не видно.
 */
export function createStreaks(count: number, zones: readonly DustZone[], seed = 11): LineSegments {
  const r = rand(seed);
  const pos = new Float32Array(count * 6);
  const ends = new Float32Array(count * 2);
  const seeds = new Float32Array(count * 2);
  const total = zones.reduce((s, z) => s + z.share, 0);
  let i = 0;
  for (const zone of zones) {
    const n = Math.round((count * zone.share) / total);
    for (let k = 0; k < n && i < count; k++, i++) {
      const x = zone.center.x + (r() - 0.5) * zone.size.x;
      const y = zone.center.y + (r() - 0.5) * zone.size.y;
      const z = zone.center.z + (r() - 0.5) * zone.size.z;
      const s = r();
      pos.set([x, y, z, x, y, z], i * 6);
      ends.set([0, 1], i * 2);
      seeds.set([s, s], i * 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos.subarray(0, i * 6), 3));
  geometry.setAttribute('aEnd', new BufferAttribute(ends.subarray(0, i * 2), 1));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds.subarray(0, i * 2), 1));
  const material = additive(
    new ShaderMaterial({
      uniforms: {
        uVel: { value: new Vector3() },
        uColor: { value: new Color('#dfe6ff') },
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: /* glsl */ `
        attribute float aEnd;
        attribute float aSeed;
        uniform vec3 uVel;
        varying float vAlpha;
        ${FOG}
        void main() {
          float speed = length(uVel);
          vec3 p = position + uVel * aEnd * (0.035 + aSeed * 0.05);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float depth = -mv.z;
          vAlpha = smoothstep(3.0, 16.0, speed) * (1.0 - aEnd * 0.9) * (0.25 + aSeed * 0.75)
            * (1.0 - fogAmount(depth)) * smoothstep(0.5, 2.5, depth);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor * vAlpha, 0.0);
        }
      `,
    }),
  );
  const lines = new LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

export type FlowMode = 'rise' | 'spiral' | 'vortex' | 'fall';

export interface FlowOptions {
  count: number;
  mode: FlowMode;
  center: Vector3;
  /** радиус (spiral, vortex) или полуширина облака (rise, fall) */
  radius: number;
  height: number;
  /** скорость движения */
  speed: number;
  size: number;
  colors: readonly string[];
  seed?: number;
}

/**
 * Потоки частиц у станций: rise — искры поднимаются от земли, spiral — колонна света закручивается
 * вверх, vortex — воронка втягивает энергию в центр, fall — частицы опускаются лучом сверху.
 */
export function createFlow(o: FlowOptions): Points {
  const r = rand(o.seed ?? 3);
  const seeds = new Float32Array(o.count * 4);
  const colors = new Float32Array(o.count * 3);
  const c = new Color();
  for (let i = 0; i < o.count; i++) {
    for (let s = 0; s < 4; s++) seeds[i * 4 + s] = r();
    c.set(o.colors[Math.floor(r() * o.colors.length)]!);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geometry = new BufferGeometry();
  // позиции считает шейдер; атрибут position нужен WebGL — нули
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(o.count * 3), 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  const material = additive(
    new ShaderMaterial({
      defines: { [`MODE_${o.mode.toUpperCase()}`]: '' },
      uniforms: {
        uCenter: { value: o.center.clone() },
        uRadius: { value: o.radius },
        uHeight: { value: o.height },
        uSpeed: { value: o.speed },
        uSize: { value: o.size },
        uOpacity: { value: 1 },
        uTint: { value: new Color('#ffffff') },
        uTintMix: { value: 0 },
        uScale: pointScale,
        uTime: globals.uTime,
        uPixelRatio: globals.uPixelRatio,
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        attribute vec3 aColor;
        uniform vec3 uCenter;
        uniform float uRadius;
        uniform float uHeight;
        uniform float uSpeed;
        uniform float uSize;
        uniform float uOpacity;
        uniform vec3 uTint;
        uniform float uTintMix;
        uniform float uScale;
        uniform float uTime;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        ${FOG}
        void main() {
          float life = fract(aSeed.w + uTime * uSpeed * (0.35 + aSeed.z * 0.65) / uHeight);
          vec3 p = uCenter;
          float fade = sin(3.14159 * life);
          #ifdef MODE_RISE
            p.x += (aSeed.x - 0.5) * 2.0 * uRadius + sin(uTime * 1.1 + aSeed.y * 30.0) * 0.18;
            p.z += (aSeed.y - 0.5) * 2.0 * uRadius * 0.6;
            p.y += life * uHeight;
          #endif
          #ifdef MODE_FALL
            p.x += (aSeed.x - 0.5) * 2.0 * uRadius * (0.3 + life * 0.7);
            p.z += (aSeed.y - 0.5) * 2.0 * uRadius * (0.3 + life * 0.7);
            p.y += (1.0 - life) * uHeight;
          #endif
          #ifdef MODE_SPIRAL
            float ang = aSeed.x * 6.2831 + uTime * (0.25 + aSeed.z * 0.45) + life * 3.0;
            float rad = uRadius * (0.12 + aSeed.y * aSeed.y * 0.88);
            p += vec3(cos(ang) * rad, life * uHeight, sin(ang) * rad);
          #endif
          #ifdef MODE_VORTEX
            float rad = mix(uRadius, 0.2, pow(life, 0.7));
            float ang = aSeed.x * 6.2831 + life * 6.0 + uTime * 0.15;
            p += vec3(cos(ang) * rad, (aSeed.y - 0.5) * uHeight * (1.0 - life) , sin(ang) * rad * 0.55);
            fade = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.85, 1.0, life));
          #endif
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float depth = -mv.z;
          gl_PointSize = clamp(uSize * (0.4 + aSeed.z * 1.2) * uScale / max(depth, 0.1), 0.0, 60.0 * uPixelRatio);
          vColor = mix(aColor, uTint, uTintMix);
          vAlpha = fade * uOpacity * (0.4 + 0.6 * aSeed.y) * (1.0 - fogAmount(depth));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: SOFT_POINT,
    }),
  );
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

const BURST_POOL = 240;
const BURST_LIFE = 0.9;

/** Всплески искр от тапа: пул частиц, физика на процессоре только пока всплеск жив. */
export class Bursts {
  readonly points: Points;
  private pos = new Float32Array(BURST_POOL * 3);
  private vel = new Float32Array(BURST_POOL * 3);
  private age = new Float32Array(BURST_POOL).fill(BURST_LIFE);
  private alpha = new Float32Array(BURST_POOL);
  private color = new Float32Array(BURST_POOL * 3);
  private next = 0;
  private alive = 0;
  private c = new Color();

  constructor() {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));
    geometry.setAttribute('aColor', new BufferAttribute(this.color, 3).setUsage(DynamicDrawUsage));
    const material = additive(
      new ShaderMaterial({
        uniforms: { uScale: pointScale, uPixelRatio: globals.uPixelRatio },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          attribute vec3 aColor;
          uniform float uScale;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = clamp(0.09 * (0.5 + aAlpha) * uScale / max(-mv.z, 0.1), 0.0, 40.0 * uPixelRatio);
            vColor = aColor;
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: SOFT_POINT,
      }),
    );
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
  }

  emit(at: Vector3, count: number, colors: readonly string[], power = 1): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % BURST_POOL;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const s = (1.2 + Math.random() * 2.6) * power;
      this.pos.set([at.x, at.y, at.z], i * 3);
      this.vel.set([Math.cos(a) * s * 0.8, up * s, Math.sin(a) * s * 0.5 + 0.6], i * 3);
      this.age[i] = Math.random() * 0.15;
      this.c.set(colors[k % colors.length]!);
      this.color.set([this.c.r, this.c.g, this.c.b], i * 3);
    }
    this.alive = BURST_LIFE;
  }

  update(dt: number): void {
    if (this.alive <= 0) return;
    this.alive -= dt;
    for (let i = 0; i < BURST_POOL; i++) {
      if (this.age[i]! >= BURST_LIFE) {
        this.alpha[i] = 0;
        continue;
      }
      const age = (this.age[i]! += dt);
      const drag = Math.exp(-dt * 2.4);
      this.vel[i * 3]! *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * drag - 3.2 * dt;
      this.vel[i * 3 + 2]! *= drag;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      const k = age / BURST_LIFE;
      this.alpha[i] = Math.max(0, 1 - k) * (k < 0.08 ? k / 0.08 : 1);
    }
    const g = this.points.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.aAlpha!.needsUpdate = true;
    g.attributes.aColor!.needsUpdate = true;
  }
}
