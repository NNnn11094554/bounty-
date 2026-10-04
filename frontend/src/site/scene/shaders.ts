import {
  Color,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  Vector2,
  type Texture,
} from 'three';

/**
 * Шейдеры сцены. Цвета — в пространстве sRGB, как у браузера (ColorManagement выключен, вывод без
 * преобразования): арт котов на экране — ровно тех цветов, что в исходнике, а свет и туман смешиваются
 * так же, как CSS. Прозрачность — с предумноженной альфой: на краях силуэта нет ореола фона.
 */

/** Общие для всех материалов значения: время, туман (его цвет меняется со станцией), плотность пикселей. */
export const globals = {
  uTime: { value: 0 },
  uFog: { value: new Color('#05040a') },
  uFogNear: { value: 10 },
  uFogFar: { value: 46 },
  uPixelRatio: { value: 1 },
};

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + 17.0;
    a *= 0.5;
  }
  return v;
}
`;

const FOG = /* glsl */ `
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
float fogAmount(float depth) {
  return smoothstep(uFogNear, uFogFar, depth);
}
`;

const DEPTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/** Смешивание с предумноженной альфой (обычная прозрачность). */
function premultiplied(material: ShaderMaterial): ShaderMaterial {
  material.transparent = true;
  material.premultipliedAlpha = true;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneMinusSrcAlphaFactor;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = OneMinusSrcAlphaFactor;
  return material;
}

/** Свечение: складывается со сценой (частицы, ореолы, лучи, стекло). */
function additive(material: ShaderMaterial): ShaderMaterial {
  material.transparent = true;
  material.depthWrite = false;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = OneFactor;
  material.blendDstAlpha = OneFactor;
  return material;
}

export interface CatUniforms {
  map: { value: Texture | null };
  uOpacity: { value: number };
  /** проявление 0…1: кот собирается из искр от лап к ушам */
  uReveal: { value: number };
  uDim: { value: number };
  uRim: { value: Color };
  uRimStrength: { value: number };
  uEdge: { value: Color };
  /** направление на источник контрового света (в долях картинки) */
  uLight: { value: Vector2 };
  uReflect: { value: number };
  uSeed: { value: number };
  /** вспышка при тапе */
  uFlash: { value: number };
}

/**
 * Персонаж: резкий арт без изменений + контровой свет по краю силуэта со стороны света мира,
 * проявление из искр, отражение на полу (uReflect) и туман.
 */
export function catMaterial(reflect = false): ShaderMaterial & { uniforms: CatUniforms } {
  const uniforms: CatUniforms = {
    map: { value: null },
    uOpacity: { value: 1 },
    uReveal: { value: 1 },
    uDim: { value: 1 },
    uRim: { value: new Color('#ffffff') },
    uRimStrength: { value: 0.8 },
    uEdge: { value: new Color('#ffffff') },
    uLight: { value: new Vector2(0.006, 0.01) },
    uReflect: { value: reflect ? 1 : 0 },
    uSeed: { value: Math.random() * 50 },
    uFlash: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, uFog: globals.uFog, uFogNear: globals.uFogNear, uFogFar: globals.uFogFar },
    vertexShader: DEPTH_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uOpacity;
      uniform float uReveal;
      uniform float uDim;
      uniform vec3 uRim;
      uniform float uRimStrength;
      uniform vec3 uEdge;
      uniform vec2 uLight;
      uniform float uReflect;
      uniform float uSeed;
      uniform float uFlash;
      varying vec2 vUv;
      varying float vDepth;
      ${NOISE}
      ${FOG}
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.003) discard;
        float rim = clamp(c.a - texture2D(map, vUv + uLight).a, 0.0, 1.0);
        vec3 col = c.rgb * uDim + uRim * rim * uRimStrength + c.rgb * uFlash;
        float a = c.a;
        if (uReveal < 1.0) {
          float n = fbm(vUv * vec2(7.0, 11.0) + uSeed) * 0.5 + vUv.y * 0.5;
          float e = uReveal * 1.32 - n;
          float vis = smoothstep(0.0, 0.05, e);
          float band = smoothstep(-0.14, 0.0, e) * (1.0 - smoothstep(0.0, 0.09, e));
          col = col * vis + uEdge * band * a * 1.6;
          a *= vis;
        }
        if (uReflect > 0.5) {
          float k = (1.0 - smoothstep(0.0, 0.42, vUv.y)) * 0.3;
          col *= k;
          a *= k;
        }
        float fog = fogAmount(vDepth);
        col = mix(col, uFog * a, fog);
        // в густом тумане персонаж растворяется, а не темнеет силуэтом на фоне мира
        gl_FragColor = vec4(col, a) * uOpacity * (1.0 - smoothstep(0.55, 1.0, fog));
      }
    `,
  });
  material.depthWrite = false;
  return premultiplied(material) as ShaderMaterial & { uniforms: CatUniforms };
}

/**
 * Глубина силуэта (без цвета): частицы за котом не просвечивают сквозь него, а мягкий край меха
 * (альфа < 0.5) глубину не пишет — там частицы видны, как и должны.
 */
export function depthMaskMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: { map: { value: null } },
    vertexShader: DEPTH_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        if (texture2D(map, vUv).a < 0.5) discard;
        gl_FragColor = vec4(0.0);
      }
    `,
  });
  material.colorWrite = false;
  return material;
}

/** Мир персонажа за ним: приглушён, по краям уходит в туман (виньетка). */
export function backdropMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      map: { value: null },
      uOpacity: { value: 1 },
      uDim: { value: 0.62 },
      /** насколько мир растворён в тумане станции 0…1 */
      uFogMix: { value: 0 },
      /** мягкость мира (смещение мип-уровня): глубина резкости — мир позади, коты резкие */
      uSoft: { value: 0.8 },
      uFog: globals.uFog,
    },
    vertexShader: DEPTH_VERTEX,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uOpacity;
      uniform float uDim;
      uniform float uFogMix;
      uniform float uSoft;
      uniform vec3 uFog;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(map, vUv, uSoft).rgb * uDim;
        vec2 q = (vUv - vec2(0.5, 0.46)) * vec2(1.25, 1.0);
        float v = 1.0 - smoothstep(0.22, 0.62, length(q));
        c = mix(uFog, c, v * (1.0 - uFogMix));
        gl_FragColor = vec4(c, 1.0) * uOpacity;
      }
    `,
  });
  material.depthWrite = false;
  return premultiplied(material);
}

/** Стеклянное кольцо: френель, радужный перелив и блик, бегущий по кругу. */
export function glassMaterial(tint: string, tint2: string): ShaderMaterial {
  return additive(
    new ShaderMaterial({
      uniforms: {
        uTint: { value: new Color(tint) },
        uTint2: { value: new Color(tint2) },
        uOpacity: { value: 1 },
        uSpeed: { value: 0.6 },
        uTime: globals.uTime,
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vPos;
        varying float vDepth;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          vPos = position;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTint;
        uniform vec3 uTint2;
        uniform float uOpacity;
        uniform float uSpeed;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vPos;
        varying float vDepth;
        ${FOG}
        void main() {
          float f = 1.0 - abs(dot(normalize(vNormal), normalize(vView)));
          float fres = pow(f, 2.0);
          vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.1 + uTime * 0.04 + vPos.x * 0.12));
          vec3 col = mix(uTint, irid, 0.38) * (0.05 + fres * 1.35);
          float ang = atan(vPos.y, vPos.x);
          float hl = pow(max(0.0, sin(ang - uTime * uSpeed)), 28.0);
          col += uTint2 * hl * (0.35 + fres) * 1.3;
          col *= (1.0 - fogAmount(vDepth)) * uOpacity;
          gl_FragColor = vec4(col, 0.0);
        }
      `,
    }),
  );
}

/**
 * Золото монеты PAW: студийный свет без карты окружения (яркая полоса сверху, блики по бокам),
 * рельеф лапы на гранях (map — маска рельефа) и рифление ребра.
 */
export function goldMaterial(map: Texture | null, ridges: boolean): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uRidges: { value: ridges ? 1 : 0 },
      uGlow: { value: 0 },
      uTime: globals.uTime,
      uFog: globals.uFog,
      uFogNear: globals.uFogNear,
      uFogFar: globals.uFogFar,
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vUv = uv;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float uHasMap;
      uniform float uRidges;
      uniform float uGlow;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;
      varying float vDepth;
      ${FOG}
      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(vView);
        float relief = 0.0;
        if (uHasMap > 0.5) {
          vec2 px = vec2(1.5 / 512.0, 0.0);
          float h = texture2D(map, vUv).a;
          float hx = texture2D(map, vUv + px.xy).a - texture2D(map, vUv - px.xy).a;
          float hy = texture2D(map, vUv + px.yx).a - texture2D(map, vUv - px.yx).a;
          n = normalize(n + vec3(hx, hy, 0.0) * 1.4);
          relief = h;
        }
        vec3 r = reflect(-v, n);
        float sweep = sin(uTime * 0.35) * 0.35;
        float env = 0.18 + smoothstep(-0.5, 0.9, r.y) * 0.75
          + pow(max(0.0, r.x * 0.7 + r.y * 0.7 + sweep), 14.0) * 1.6
          + pow(max(0.0, -r.x * 0.8 + r.y * 0.3), 6.0) * 0.45;
        vec3 deep = vec3(0.6, 0.36, 0.07);
        vec3 bright = vec3(1.0, 0.88, 0.5);
        vec3 col = mix(deep, bright, clamp(env, 0.0, 1.0)) + vec3(1.0, 0.95, 0.82) * max(0.0, env - 1.0);
        col *= 1.0 - relief * 0.28;
        if (uRidges > 0.5) col *= 0.82 + 0.18 * smoothstep(0.35, 0.65, fract(vUv.x * 180.0));
        float ndv = max(dot(n, v), 0.0);
        col += vec3(1.0, 0.7, 0.3) * pow(1.0 - ndv, 3.0) * (0.25 + uGlow);
        col = mix(col, uFog, fogAmount(vDepth));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/** Плоская картинка со свечением (ореолы, лужи света, лучи): складывается со сценой. */
export function glowMaterial(map: Texture, color: string, opacity = 1): ShaderMaterial {
  return additive(
    new ShaderMaterial({
      uniforms: {
        map: { value: map },
        uColor: { value: new Color(color) },
        uOpacity: { value: opacity },
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: DEPTH_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vDepth;
        ${FOG}
        void main() {
          float a = texture2D(map, vUv).a;
          gl_FragColor = vec4(uColor * a * uOpacity * (1.0 - fogAmount(vDepth)), 0.0);
        }
      `,
    }),
  );
}

/** Стеклянная панель с картинкой (карточки активов, награды): картинка + свет по краю. */
export function panelMaterial(map: Texture, edge: string): ShaderMaterial {
  return premultiplied(
    new ShaderMaterial({
      uniforms: {
        map: { value: map },
        uEdge: { value: new Color(edge) },
        uOpacity: { value: 1 },
        uTime: globals.uTime,
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: DEPTH_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 uEdge;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        varying float vDepth;
        ${FOG}
        void main() {
          vec4 c = texture2D(map, vUv);
          float sweep = smoothstep(0.08, 0.0, abs(vUv.x + vUv.y * 0.6 - fract(uTime * 0.12) * 2.4 + 0.4));
          c.rgb += uEdge * sweep * 0.25 * c.a;
          float fog = fogAmount(vDepth);
          c.rgb = mix(c.rgb, uFog * c.a, fog);
          c.a *= 1.0 - fog * 0.6;
          gl_FragColor = c * uOpacity;
        }
      `,
    }),
  );
}

/** Пол: тёмное мокрое стекло, лужа света под персонажем, к краям — туман. */
export function floorMaterial(): ShaderMaterial {
  return premultiplied(
    new ShaderMaterial({
      uniforms: {
        uPool: { value: new Color('#ff7a1a') },
        uPoolStrength: { value: 0.5 },
        uOpacity: { value: 1 },
        uTime: globals.uTime,
        uFog: globals.uFog,
        uFogNear: globals.uFogNear,
        uFogFar: globals.uFogFar,
      },
      vertexShader: DEPTH_VERTEX,
      fragmentShader: /* glsl */ `
        uniform vec3 uPool;
        uniform float uPoolStrength;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        varying float vDepth;
        ${NOISE}
        ${FOG}
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(p * vec2(1.0, 1.6));
          float pool = exp(-d * d * 7.0);
          float wet = fbm(vUv * 24.0 + uTime * 0.02) * 0.35;
          vec3 col = uPool * pool * uPoolStrength * (0.75 + wet);
          float a = (1.0 - smoothstep(0.35, 1.0, d)) * 0.92;
          col = mix(col, uFog * a, fogAmount(vDepth) * 0.8);
          vec3 base = uFog * 0.55 * a;
          gl_FragColor = vec4(base + col * a, a) * uOpacity;
        }
      `,
    }),
  );
}

/** Кольцо прогресса Airdrop: 6 делений-требований, заполненные светятся, по ним бежит блик. */
export function progressRingMaterial(colorA: string, colorB: string): ShaderMaterial {
  return additive(
    new ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uSegments: { value: 6 },
        uColA: { value: new Color(colorA) },
        uColB: { value: new Color(colorB) },
        uOpacity: { value: 1 },
        uTime: globals.uTime,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProgress;
        uniform float uSegments;
        uniform vec3 uColA;
        uniform vec3 uColB;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.x, p.y) / 6.28318 + 0.5;
          a = fract(a + 0.5);
          float line = smoothstep(0.022, 0.0, abs(r - 0.9));
          float halo = exp(-pow((r - 0.9) / 0.07, 2.0));
          float seg = fract(a * uSegments);
          float gap = smoothstep(0.0, 0.025, seg) * smoothstep(1.0, 0.975, seg);
          float filled = step(a, uProgress);
          vec3 tone = mix(uColA, uColB, a);
          vec3 col = mix(vec3(0.16, 0.15, 0.28), tone, filled) * line * gap;
          col += tone * halo * filled * 0.35;
          float shine = filled * pow(max(0.0, sin((a - uTime * 0.12) * 6.28318)), 40.0);
          col += uColB * shine * line * 1.4;
          float ticks = smoothstep(0.012, 0.0, abs(r - 0.8)) * step(0.97, fract(a * uSegments * 8.0)) * 0.35;
          gl_FragColor = vec4((col + vec3(ticks)) * uOpacity, 0.0);
        }
      `,
    }),
  );
}

export { additive, premultiplied, FOG };
