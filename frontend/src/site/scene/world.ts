import {
  CylinderGeometry,
  ColorManagement,
  Color,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { CATS, HERO_CAT, catArt, type CatArt, type SiteCat } from '../cats';
import { AIRDROP_REQS, FLOATING_ASSETS } from '../content';
import { clamp01, introPhase, nearness, smoothstep, type View } from '../timeline';
import { CatFigure } from './catFigure';
import { Bursts, createDust, createFlow, createStreaks, pointScale, type DustZone } from './particles';
import { applyCamera, landscapeness, Rig, type Leg, type Shot } from './rig';
import {
  backdropMaterial,
  floorMaterial,
  globals,
  glassMaterial,
  glowMaterial,
  goldMaterial,
  panelMaterial,
  progressRingMaterial,
} from './shaders';
import {
  TextureBank,
  glowCanvas,
  makeCanvas,
  pawReliefCanvas,
  rayCanvas,
  ringCanvas,
  svgCanvas,
} from './textures';
import { tokenSvg } from './tokenArt';

// цвета задаются как в CSS (sRGB) и так же выводятся — без преобразований
ColorManagement.enabled = false;

/** Высота персонажа в единицах сцены. */
const CAT_H = 3.2;
const STEP = (Math.PI * 2) / CATS.length;

/** Где стоят станции. */
const HOME = new Vector3(0, 0, 0);
const COLLECTION = new Vector3(0, 0, -52);
const RING_R = 3.6;
const UPGRADES = new Vector3(0, 0, -104);
const EARN = new Vector3(0, 0, -152);
const AIRDROP = new Vector3(0, 3.1, -200);

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

const SHOTS: Shot[] = [
  // главная: кот справа, слева — заголовок; на телефоне кот ниже, заголовок сверху
  {
    target: v3(0, 1.6, 0),
    dir: v3(0, 0.05, 1),
    fit: [3, 4.4],
    fitPortrait: [2.75, 5.5],
    shift: [0.23, 0],
    shiftPortrait: [0, -0.1],
  },
  // игра: кот в центре, вокруг — интерфейс игры
  {
    target: v3(0, 1.45, 0),
    dir: v3(0, 0.17, 1),
    fit: [3, 5.6],
    fitPortrait: [2.9, 6.9],
    shift: [0, -0.04],
    shiftPortrait: [0, -0.03],
  },
  // коллекция: выбранный кот впереди кольца, информация — справа (на телефоне — снизу)
  {
    target: v3(0, 1.62, COLLECTION.z + RING_R),
    dir: v3(0, 0.1, 1),
    fit: [4, 4.7],
    fitPortrait: [3.1, 7.4],
    shift: [-0.17, 0],
    shiftPortrait: [0, 0.14],
  },
  // прокачка: инженер Токсик среди летящих монет-активов, панель — слева
  {
    target: v3(0, 2.1, UPGRADES.z),
    dir: v3(0.16, 0.06, 1),
    fit: [7.6, 6.2],
    fitPortrait: [5.2, 9.4],
    shift: [0.19, 0],
    shiftPortrait: [0, 0.13],
  },
  // задания: Странник в спирали наград, панель — справа
  {
    target: v3(0, 2.7, EARN.z),
    dir: v3(-0.12, 0.08, 1),
    fit: [6.4, 7],
    fitPortrait: [5, 10.2],
    shift: [-0.22, 0],
    shiftPortrait: [0, 0.15],
  },
  // Airdrop: монета PAW в кольцах, панель — слева
  {
    target: AIRDROP.clone(),
    dir: v3(0, 0.05, 1),
    fit: [9.4, 9],
    fitPortrait: [7, 15],
    shift: [0.2, 0],
    shiftPortrait: [0, 0.25],
  },
];

/** Дуги перелётов: камера поднимается, уходит в сторону — пространство раскрывается по пути. */
const LEGS: Leg[] = [
  { arc: v3(0, -0.4, 0) },
  { arc: v3(3, 4.5, 0) },
  { arc: v3(-3.5, 1.5, 0) },
  { arc: v3(3.8, -0.6, 0) },
  { arc: v3(0, 5.5, 0) },
];

/** Тон пространства у станций (у коллекции — тон мира выбранного кота). */
const STATION_FOG = ['#0d0603', '#07060c', '', '#030a06', '#0d0904', '#07051a'];

const DUST_ZONES: DustZone[] = [
  {
    center: v3(0, 3, -2),
    size: v3(26, 14, 22),
    colors: ['#ff9a4d', '#ffcf8a', '#ff5e2b', '#ffffff'],
    share: 0.18,
  },
  { center: v3(2, 4, -26), size: v3(20, 14, 34), colors: ['#cfd6ff', '#ffffff', '#9fb0ff'], share: 0.13 },
  { center: v3(0, 3, -52), size: v3(28, 14, 26), colors: ['#ffffff', '#d9d2ff'], share: 0.18 },
  { center: v3(-1, 3, -78), size: v3(20, 12, 28), colors: ['#c8f7ff', '#ffffff'], share: 0.09 },
  {
    center: v3(0, 3, -104),
    size: v3(26, 14, 24),
    colors: ['#7dff3a', '#d4ff5a', '#7ce9df', '#ffffff'],
    share: 0.14,
  },
  { center: v3(1, 3, -128), size: v3(20, 12, 26), colors: ['#ffe9b8', '#ffffff'], share: 0.07 },
  { center: v3(0, 3.5, -152), size: v3(24, 14, 22), colors: ['#ffc93c', '#ffe08a', '#f2a65a'], share: 0.1 },
  { center: v3(0, 5, -176), size: v3(20, 16, 26), colors: ['#c9b8ff', '#ffffff'], share: 0.05 },
  {
    center: v3(0, 4, -199),
    size: v3(28, 18, 26),
    colors: ['#a66bff', '#7fe3ff', '#ffffff', '#ffc93c'],
    share: 0.16,
  },
];

const STREAK_ZONES: DustZone[] = [
  { center: v3(2, 4, -26), size: v3(18, 14, 40), colors: [], share: 0.3 },
  { center: v3(-1, 3, -78), size: v3(18, 12, 40), colors: [], share: 0.25 },
  { center: v3(1, 3, -128), size: v3(18, 12, 40), colors: [], share: 0.2 },
  { center: v3(0, 5, -176), size: v3(18, 16, 40), colors: [], share: 0.25 },
];

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  lite: boolean;
  onProgress: (progress: number) => void;
}

interface Backdrop {
  mesh: Mesh;
  material: ShaderMaterial;
  id: string | null;
  fade: number;
}

/**
 * Сцена сайта: одно пространство, в котором стоят все станции. Камера летит по таймлайну (Rig),
 * у каждой станции — свои объекты, свет и тон тумана; дальние станции не рисуются.
 */
export class SiteWorld {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 1, 0.1, 140);
  private bank: TextureBank;
  private rig = new Rig(SHOTS, LEGS);
  private width = 1;
  private height = 1;
  private baseRatio: number;
  private ratio: number;
  private lite: boolean;
  private slowFor = 0;
  private fastFor = 0;
  private frameAvg = 1 / 60;

  private glow: Texture;
  private ray: Texture;
  private ring: Texture;

  private stations: Group[] = [];
  private dust: ReturnType<typeof createDust>;
  private streaks: ReturnType<typeof createStreaks>;
  private bursts = new Bursts();

  // главная и игра
  private hero: CatFigure;
  private heroBackdrop: Backdrop;
  private portal: Mesh[] = [];
  private rays: Mesh[] = [];
  private halo: Mesh;
  private embers: ReturnType<typeof createFlow>;
  private energyRing: Mesh;
  private homeFloor: Mesh;

  // коллекция
  private figures: CatFigure[] = [];
  private ringAngle = 0;
  private selected = 0;
  private selectedAt = 0;
  private backdrops: Backdrop[] = [];
  /** какой из двух слотов мира коллекции сейчас проявляется (другой гаснет) */
  private backdropFront = 0;
  private column: ReturnType<typeof createFlow>;
  private beam: Mesh;
  private pedestals: Mesh[] = [];
  private catTint = new Color(HERO_CAT.accent);
  private catFog = new Color(HERO_CAT.fog);

  // прокачка, задания, airdrop
  private engineer: CatFigure;
  private tokenCards: Mesh[] = [];
  private nomad: CatFigure;
  private rewardCoins: Mesh[] = [];
  private coin: Group;
  private gyro: Mesh[] = [];
  private progressRing: Mesh;
  private vortex: ReturnType<typeof createFlow>;
  private fall: ReturnType<typeof createFlow>;

  private offset = new Vector3();
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private shake = { x: 0, y: 0, vx: 0, vy: 0 };
  private camPush = { x: 0, v: 0 };
  private fog = new Color();
  private tmpColor = new Color();
  private lastPos = new Vector3();
  private velocity = new Vector3();
  private readyAt = -1;

  constructor(private options: WorldOptions) {
    this.lite = options.lite;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.baseRatio = this.lite ? Math.min(dpr, 1.5) : dpr;
    this.ratio = this.baseRatio;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: this.baseRatio < 1.5,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setPixelRatio(this.ratio);
    this.bank = new TextureBank(this.renderer);

    this.glow = this.bank.canvas(glowCanvas());
    this.ray = this.bank.canvas(rayCanvas());
    this.ring = this.bank.canvas(ringCanvas());

    for (let i = 0; i < 6; i++) {
      const g = new Group();
      this.stations.push(g);
      this.scene.add(g);
    }
    // главная и игра — одна площадка
    this.stations[1] = this.stations[0]!;

    const scale = this.lite ? 0.45 : matchMedia('(pointer: coarse)').matches ? 0.6 : 1;
    this.dust = createDust(Math.round(7000 * scale), DUST_ZONES);
    this.streaks = createStreaks(Math.round(900 * scale), STREAK_ZONES);
    this.dust.renderOrder = 15;
    this.streaks.renderOrder = 16;
    this.scene.add(this.dust, this.streaks, this.bursts.points);

    // ── главная / игра ──
    const home = this.stations[0]!;
    this.hero = new CatFigure(HERO_CAT, CAT_H, this.glow);
    this.heroBackdrop = this.makeBackdrop(home);
    this.homeFloor = this.makeFloor(home, HOME, 18, HERO_CAT.accent, 0.55);
    this.halo = this.glowPlane(home, '#ff6a1a', 7, v3(0, 2.3, -1.6), 0.4);
    const portal = new Mesh(new TorusGeometry(2.25, 0.04, 24, 200), glassMaterial('#ff9a4d', '#ffe0a8'));
    portal.position.set(0, 1.9, -1.3);
    const inner = new Mesh(new TorusGeometry(2.02, 0.012, 12, 200), glassMaterial('#ffb36b', '#fff1d6'));
    inner.position.copy(portal.position);
    (inner.material as ShaderMaterial).uniforms.uSpeed!.value = -0.9;
    this.portal = [portal, inner];
    for (const m of this.portal) {
      m.renderOrder = 3;
      home.add(m);
    }
    for (let i = 0; i < 5; i++) {
      const ray = new Mesh(new PlaneGeometry(1, 1), glowMaterial(this.ray, '#ffb36b', 0.16));
      ray.scale.set(1.2 + i * 0.35, 16, 1);
      ray.position.set(-3 + i * 1.5, 7.2, -3.2 - i * 0.3);
      ray.rotation.z = -0.32 + i * 0.16;
      ray.renderOrder = 2;
      this.rays.push(ray);
      home.add(ray);
    }
    this.embers = createFlow({
      count: this.lite ? 140 : 320,
      mode: 'rise',
      center: v3(0, -0.2, -0.6),
      radius: 3.6,
      height: 6.5,
      speed: 0.9,
      size: 0.06,
      colors: ['#ff8a2a', '#ffc35a', '#ff5a1f'],
    });
    this.embers.renderOrder = 14;
    home.add(this.embers);
    this.energyRing = this.flatGlow(home, this.ring, '#ffc93c', 4.2, v3(0, 0.02, 0), 0);
    home.add(this.hero.group);

    // ── коллекция ──
    const collection = this.stations[2]!;
    this.backdrops = [this.makeBackdrop(collection), this.makeBackdrop(collection)];
    this.makeFloor(collection, COLLECTION, 26, '#ffffff', 0.25);
    for (const cat of CATS) {
      const figure = new CatFigure(cat, CAT_H, this.glow);
      this.figures.push(figure);
      // постамент — светящееся кольцо на полу в цвет персонажа
      this.pedestals.push(this.flatGlow(collection, this.ring, cat.accent, 2.7, v3(0, 0.03, 0), 0));
      collection.add(figure.group);
    }
    this.column = createFlow({
      count: this.lite ? 260 : 620,
      mode: 'spiral',
      center: v3(COLLECTION.x, -0.5, COLLECTION.z),
      radius: 1.3,
      height: 10,
      speed: 1.4,
      size: 0.07,
      colors: ['#ffffff', '#e8e0ff'],
    });
    this.column.renderOrder = 14;
    collection.add(this.column);
    this.beam = new Mesh(new PlaneGeometry(1, 1), glowMaterial(this.ray, '#ffffff', 0.22));
    this.beam.scale.set(2.2, 14, 1);
    this.beam.rotation.z = Math.PI;
    this.beam.position.set(COLLECTION.x, 5.5, COLLECTION.z);
    this.beam.renderOrder = 2;
    collection.add(this.beam);
    this.glowPlane(collection, '#ffffff', 9, v3(0, 2.5, COLLECTION.z - 0.5), 0.12);

    // ── прокачка ──
    const upgrades = this.stations[3]!;
    this.engineer = new CatFigure(catById('toxic'), CAT_H, this.glow);
    this.engineer.group.position.copy(UPGRADES);
    upgrades.add(this.engineer.group);
    this.makeFloor(upgrades, UPGRADES, 18, '#7dff3a', 0.5);
    this.flatGlow(upgrades, this.ring, '#7dff3a', 4.4, v3(UPGRADES.x, 0.02, UPGRADES.z), 0.55);
    const sparks = createFlow({
      count: this.lite ? 120 : 260,
      mode: 'rise',
      center: v3(UPGRADES.x, 0, UPGRADES.z - 0.8),
      radius: 3.2,
      height: 6,
      speed: 1.1,
      size: 0.055,
      colors: ['#7dff3a', '#d4ff5a', '#ffffff'],
    });
    sparks.renderOrder = 14;
    upgrades.add(sparks);

    // ── задания ──
    const earn = this.stations[4]!;
    this.nomad = new CatFigure(catById('desert_nomad'), CAT_H, this.glow);
    this.nomad.group.position.copy(EARN);
    earn.add(this.nomad.group);
    this.makeFloor(earn, EARN, 18, '#f2a65a', 0.5);
    const pillar = new Mesh(new PlaneGeometry(1, 1), glowMaterial(this.ray, '#ffc93c', 0.2));
    pillar.scale.set(3.2, 15, 1);
    pillar.rotation.z = Math.PI;
    pillar.position.set(EARN.x, 6.8, EARN.z - 1.6);
    pillar.renderOrder = 2;
    earn.add(pillar);
    const relief = this.bank.canvas(pawReliefCanvas());
    const face = goldMaterial(relief, false);
    const side = goldMaterial(null, true);
    const small = new CylinderGeometry(0.36, 0.36, 0.07, 48);
    for (let i = 0; i < 10; i++) {
      const coin = new Mesh(small, [side, face, face]);
      coin.scale.setScalar(i === 9 ? 1.5 : 1);
      this.rewardCoins.push(coin);
      earn.add(coin);
    }

    // ── airdrop ──
    const airdrop = this.stations[5]!;
    this.coin = new Group();
    const big = new Mesh(new CylinderGeometry(1.45, 1.45, 0.24, 96), [side, face, face]);
    big.rotation.x = Math.PI / 2;
    this.coin.add(big);
    this.coin.position.copy(AIRDROP);
    airdrop.add(this.coin);
    this.glowPlane(airdrop, '#a66bff', 10, v3(AIRDROP.x, AIRDROP.y, AIRDROP.z - 1.2), 0.45);
    this.glowPlane(airdrop, '#ffc93c', 5, v3(AIRDROP.x, AIRDROP.y, AIRDROP.z - 0.6), 0.35);
    const gyroSpec: Array<[number, string, string]> = [
      [2.45, '#a66bff', '#e3b8ff'],
      [3.05, '#7fe3ff', '#ffffff'],
      [3.7, '#ffc93c', '#fff1d6'],
    ];
    for (const [r, a, b] of gyroSpec) {
      const ring = new Mesh(new TorusGeometry(r, 0.028, 16, 220), glassMaterial(a, b));
      ring.position.copy(AIRDROP);
      ring.renderOrder = 3;
      this.gyro.push(ring);
      airdrop.add(ring);
    }
    this.progressRing = new Mesh(new PlaneGeometry(9.6, 9.6), progressRingMaterial('#a66bff', '#7fe3ff'));
    this.progressRing.position.set(AIRDROP.x, AIRDROP.y, AIRDROP.z - 0.9);
    this.progressRing.renderOrder = 3;
    airdrop.add(this.progressRing);
    this.vortex = createFlow({
      count: this.lite ? 420 : 1100,
      mode: 'vortex',
      center: AIRDROP.clone(),
      radius: 6.5,
      height: 4,
      speed: 2.2,
      size: 0.065,
      colors: ['#a66bff', '#7fe3ff', '#ffffff', '#ffc93c'],
    });
    this.fall = createFlow({
      count: this.lite ? 120 : 280,
      mode: 'fall',
      center: v3(AIRDROP.x, AIRDROP.y + 0.6, AIRDROP.z),
      radius: 1.6,
      height: 9,
      speed: 2.4,
      size: 0.06,
      colors: ['#ffe08a', '#ffffff'],
    });
    this.vortex.renderOrder = this.fall.renderOrder = 14;
    airdrop.add(this.vortex, this.fall);
    const drop = new Mesh(new PlaneGeometry(1, 1), glowMaterial(this.ray, '#c9b8ff', 0.25));
    drop.scale.set(2.6, 12, 1);
    drop.rotation.z = Math.PI;
    drop.position.set(AIRDROP.x, AIRDROP.y + 6, AIRDROP.z - 0.4);
    drop.renderOrder = 2;
    airdrop.add(drop);

    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  // ───────────────────────────── построение ─────────────────────────────

  private makeBackdrop(parent: Group): Backdrop {
    const material = backdropMaterial();
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.visible = false;
    mesh.renderOrder = 0;
    parent.add(mesh);
    return { mesh, material, id: null, fade: 0 };
  }

  private makeFloor(parent: Group, at: Vector3, size: number, pool: string, strength: number): Mesh {
    const material = floorMaterial();
    material.uniforms.uPool!.value.set(pool);
    material.uniforms.uPoolStrength!.value = strength;
    const floor = new Mesh(new PlaneGeometry(size, size), material);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(at.x, 0, at.z);
    floor.renderOrder = 1;
    parent.add(floor);
    return floor;
  }

  /** Свечение, повёрнутое к камере (ореол за объектом). */
  private glowPlane(parent: Group, color: string, size: number, at: Vector3, opacity: number): Mesh {
    const mesh = new Mesh(new PlaneGeometry(size, size), glowMaterial(this.glow, color, opacity));
    mesh.position.copy(at);
    mesh.renderOrder = 2;
    parent.add(mesh);
    return mesh;
  }

  /** Свечение на полу (кольцо или лужа света). */
  private flatGlow(
    parent: Group,
    map: Texture,
    color: string,
    size: number,
    at: Vector3,
    opacity: number,
  ): Mesh {
    const mesh = new Mesh(new PlaneGeometry(size, size), glowMaterial(map, color, opacity));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at);
    mesh.renderOrder = 4;
    parent.add(mesh);
    return mesh;
  }

  /** Поставить мир кота за ним так, чтобы с точки eye кот стоял на своём месте в этом мире. */
  private placeBackdrop(b: Backdrop, art: CatArt, feet: Vector3, depth: number, eye: Vector3): void {
    const [cx, cy, , ch] = art.scene.char;
    const sceneH = CAT_H / ch;
    const sceneW = sceneH * art.scene.aspect;
    const left = feet.x - CAT_H * art.aspect * art.body;
    const center = v3(left - cx * sceneW + sceneW / 2, feet.y + CAT_H + cy * sceneH - sceneH / 2, feet.z);
    const k = (eye.z - (feet.z - depth)) / (eye.z - feet.z);
    center.sub(eye).multiplyScalar(k).add(eye);
    b.mesh.position.copy(center);
    b.mesh.scale.set(sceneW * k, sceneH * k, 1);
  }

  // ───────────────────────────── загрузка ─────────────────────────────

  private charPx(): number {
    return Math.min(1400, window.innerHeight * 0.68);
  }

  private worldPx(): number {
    return Math.max(window.innerWidth, window.innerHeight * 0.73) * 1.15;
  }

  private async loadCat(figure: CatFigure): Promise<void> {
    const texture = await this.bank.art(figure.cat.id, 'character', this.charPx(), this.ratio);
    figure.setTexture(texture, catArt(figure.cat.id));
  }

  private async setBackdrop(b: Backdrop, cat: SiteCat): Promise<void> {
    const texture = await this.bank.art(cat.id, 'background', this.worldPx(), this.ratio);
    b.material.uniforms.map!.value = texture;
    b.id = cat.id;
    b.mesh.visible = true;
  }

  /** Главное — сразу (кот и его мир), остальное — после старта, по порядку появления. */
  async load(): Promise<void> {
    const steps = 3;
    let done = 0;
    const tick = () => this.options.onProgress(++done / steps);
    const fonts = document.fonts?.ready ?? Promise.resolve();
    await Promise.all([
      this.loadCat(this.hero).then(tick),
      this.setBackdrop(this.heroBackdrop, HERO_CAT).then(tick),
      fonts.then(tick),
    ]);
    this.placeBackdrop(this.heroBackdrop, catArt(HERO_CAT.id), HOME, 10, v3(0, 1.6, 7));
    this.hero.reveal = 0;
    // первый кадр со всеми шейдерами — до вступления, без рывка в его начале
    this.renderer.compile(this.scene, this.camera);
    void this.loadRest();
  }

  private async loadRest(): Promise<void> {
    await this.buildTokenCards();
    // коты коллекции — текстуры общие с прокачкой и заданиями
    const order = [0, 1, 5, 2, 4, 3];
    for (const i of order) {
      await this.loadCat(this.figures[i]!);
      if (CATS[i]!.id === 'toxic')
        this.engineer.setTexture(this.figures[i]!.material.uniforms.map.value!, catArt('toxic'));
      if (CATS[i]!.id === 'desert_nomad')
        this.nomad.setTexture(this.figures[i]!.material.uniforms.map.value!, catArt('desert_nomad'));
    }
    await this.showSelected();
  }

  private async buildTokenCards(): Promise<void> {
    const upgrades = this.stations[3]!;
    for (const [i, asset] of FLOATING_ASSETS.entries()) {
      const coin = await svgCanvas(tokenSvg(`token/${asset.ticker}/${asset.palette}`, 256), 256);
      const map = this.bank.canvas(tokenCard(coin, asset.ticker, asset.group));
      const card = new Mesh(new PlaneGeometry(1.3, 1.69), panelMaterial(map, '#d4ff5a'));
      card.renderOrder = 12;
      card.userData.index = i;
      this.tokenCards.push(card);
      upgrades.add(card);
    }
  }

  // ───────────────────────────── взаимодействие ─────────────────────────────

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  };

  /** Выбор кота коллекции: кольцо поворачивается, мир за ним сменяется. */
  select(index: number, time: number): void {
    if (index === this.selected) return;
    this.selected = index;
    this.selectedAt = time;
    this.camPush.v -= 2.6;
    void this.showSelected();
  }

  /** Мир выбранного кота — в свободный слот; когда загружен, он проявляется, прежний гаснет. */
  private async showSelected(): Promise<void> {
    const cat = CATS[this.selected]!;
    if (this.backdrops[this.backdropFront]!.id === cat.id) return;
    const slot = 1 - this.backdropFront;
    const next = this.backdrops[slot]!;
    await this.setBackdrop(next, cat);
    // пока грузилось, могли выбрать другого кота
    if (CATS[this.selected]!.id !== cat.id) return;
    const eye = v3(0, 1.7, COLLECTION.z + RING_R + 8);
    this.placeBackdrop(next, catArt(cat.id), v3(COLLECTION.x, 0.08, COLLECTION.z + RING_R), 12, eye);
    this.backdropFront = slot;
  }

  /** Тап в игре. NDC — от экрана; true — попал в кота. */
  tap(clientX: number, clientY: number, turbo: boolean): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const at = new Vector3();
    if (!this.hero.hit(x, y, this.camera, at)) return false;
    const side = Math.sign(at.x - this.hero.group.position.x) || 1;
    this.hero.poke(turbo ? 1 : 0.75, side);
    at.z += 0.25;
    this.bursts.emit(
      at,
      turbo ? 22 : 12,
      turbo ? ['#ffe08a', '#ff7a1a', '#ffffff'] : ['#ffc93c', '#ff9a4d'],
      turbo ? 1.3 : 1,
    );
    this.shake.vx += (Math.random() - 0.5) * (turbo ? 1.4 : 0.8);
    this.shake.vy -= turbo ? 1.2 : 0.7;
    (this.energyRing.material as ShaderMaterial).uniforms.uOpacity!.value = 1;
    return true;
  }

  /** Рамка кота игры на экране, CSS px. */
  catRect(): { x: number; y: number; width: number; height: number } | null {
    const box = this.hero.screenBox(this.camera);
    if (!box) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x0 = rect.left + ((box.x0 + 1) / 2) * rect.width;
    const x1 = rect.left + ((box.x1 + 1) / 2) * rect.width;
    const y0 = rect.top + ((1 - box.y1) / 2) * rect.height;
    const y1 = rect.top + ((1 - box.y0) / 2) * rect.height;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  // ───────────────────────────── кадр ─────────────────────────────

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    globals.uPixelRatio.value = this.ratio;
  }

  /** Качество под устройство: если кадры долгие — меньше пикселей, если быстрые — обратно. */
  private govern(dt: number): void {
    this.frameAvg += (dt - this.frameAvg) * 0.05;
    if (this.frameAvg > 1 / 42) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else if (this.frameAvg < 1 / 56) {
      this.fastFor += dt;
      this.slowFor = 0;
    } else {
      this.slowFor = this.fastFor = 0;
    }
    if (this.slowFor > 1.5 && this.ratio > 1) {
      this.ratio = Math.max(1, this.ratio - 0.25);
      this.slowFor = 0;
      this.resize();
    } else if (this.fastFor > 8 && this.ratio < this.baseRatio) {
      this.ratio = Math.min(this.baseRatio, this.ratio + 0.25);
      this.fastFor = 0;
      this.resize();
    }
  }

  frame(v: View, selected: number): void {
    const { pos, time, dt } = v;
    if (v.intro >= 0 && this.readyAt < 0) this.readyAt = time;
    if (this.readyAt >= 0 && time - this.readyAt > 1) this.govern(dt);
    globals.uTime.value = time;
    this.select(selected, time);

    // ── камера ──
    const aspect = this.width / this.height;
    const s = this.rig.solve(pos, aspect);
    const still = v.reduced;
    const intro = introPhase(0, 3.8);
    const dolly = still ? 0 : (1 - easeOutCubic(intro)) * 4.2;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * (1 - Math.exp(-dt * 2.5));
    this.pointer.y += (this.pointer.ty - this.pointer.y) * (1 - Math.exp(-dt * 2.5));
    stepSpring(this.shake, dt);
    this.camPush.v += (-60 * this.camPush.x - 11 * this.camPush.v) * dt;
    this.camPush.x += this.camPush.v * dt;
    const drift = still ? 0 : 1;
    this.offset.set(
      this.pointer.x * 0.32 * drift + this.shake.x * 0.08 + Math.sin(time * 0.21) * 0.06 * drift,
      this.pointer.y * 0.18 * drift +
        this.shake.y * 0.08 +
        Math.sin(time * 0.17) * 0.05 * drift +
        dolly * 0.22,
      dolly,
    );
    const toTarget = new Vector3().subVectors(s.target, s.position).normalize();
    this.offset.addScaledVector(toTarget, -this.camPush.x * 0.3);
    const roll = clamp(v.speed * -0.02, -0.06, 0.06) * this.rig.inFlight;
    applyCamera(this.camera, s, this.offset, this.width, this.height, roll);
    pointScale.value = (this.height * this.ratio) / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.velocity.subVectors(this.camera.position, this.lastPos).divideScalar(Math.max(dt, 1e-3));
    if (this.velocity.length() > 80) this.velocity.setLength(80);
    this.lastPos.copy(this.camera.position);
    (this.streaks.material as ShaderMaterial).uniforms.uVel!.value.copy(this.velocity);

    // ── тон пространства и туман ──
    this.fogFor(pos, selected, dt);
    const dist = s.position.distanceTo(s.target);
    globals.uFogNear.value = dist * 0.85 + 1.5;
    globals.uFogFar.value = dist + 26;

    // ── что рисовать ──
    for (let i = 0; i < 6; i++)
      if (i !== 1) this.stations[i]!.visible = Math.abs(pos - i) < 1.4 || (i === 0 && pos < 2.4);

    const reveal = introPhase(0, 1.6);
    (this.dust.material as ShaderMaterial).uniforms.uReveal!.value = reveal;
    (this.dust.material as ShaderMaterial).uniforms.uTint!.value.copy(this.catTint);
    (this.dust.material as ShaderMaterial).uniforms.uTintZ!.value = COLLECTION.z;

    this.updateHome(v, still);
    if (this.stations[2]!.visible) this.updateCollection(v, still);
    if (this.stations[3]!.visible) this.updateUpgrades(v, still);
    if (this.stations[4]!.visible) this.updateEarn(v, still);
    if (this.stations[5]!.visible) this.updateAirdrop(v, still);
    this.bursts.update(dt);

    this.renderer.setClearColor(this.fog);
    this.renderer.render(this.scene, this.camera);
  }

  private fogFor(pos: number, selected: number, dt: number): void {
    const cat = CATS[selected]!;
    this.catTint.lerp(this.tmpColor.set(cat.accent), 1 - Math.exp(-dt * 2.2));
    this.catFog.lerp(this.tmpColor.set(cat.fog), 1 - Math.exp(-dt * 2.2));
    this.fog.setRGB(0, 0, 0);
    for (let i = 0; i < STATION_FOG.length; i++) {
      const w = Math.max(0, 1 - Math.abs(pos - i));
      if (!w) continue;
      const c = i === 2 ? this.catFog : this.tmpColor.set(STATION_FOG[i]!);
      this.fog.r += c.r * w;
      this.fog.g += c.g * w;
      this.fog.b += c.b * w;
    }
    globals.uFog.value.copy(this.fog);
  }

  private updateHome(v: View, still: boolean): void {
    const { pos, time, dt } = v;
    const home = nearness(pos, 0);
    const game = nearness(pos, 1);
    const appear = (a: number, b: number) => easeOutCubic(introPhase(a, b));
    const light = appear(0.3, 1.6);
    const world = appear(0.8, 1.4);
    this.hero.reveal = introPhase(1.2, 1.9);
    this.hero.update(time, dt, still);
    this.hero.material.uniforms.uRimStrength.value = 0.75 + game * 0.25;
    const bd = this.heroBackdrop.material.uniforms;
    bd.uOpacity!.value = world;
    bd.uFogMix!.value = game * 0.5;
    bd.uDim!.value = 0.66 - game * 0.16;
    const ringScale = 0.7 + 0.3 * appear(0.3, 1.8);
    for (const [i, m] of this.portal.entries()) {
      m.scale.setScalar(ringScale * (1 + Math.sin(time * 0.6 + i) * 0.008));
      m.rotation.z = time * (i ? -0.05 : 0.03);
      m.rotation.x = 0.08 + Math.sin(time * 0.3) * 0.03;
      (m.material as ShaderMaterial).uniforms.uOpacity!.value = light * (1 - game * 0.6);
    }
    for (const [i, ray] of this.rays.entries()) {
      ray.rotation.z = -0.32 + i * 0.16 + Math.sin(time * 0.25 + i * 1.7) * 0.04;
      (ray.material as ShaderMaterial).uniforms.uOpacity!.value =
        light * (0.1 + 0.05 * Math.sin(time * 0.5 + i)) * (home + game * 0.4);
    }
    (this.halo.material as ShaderMaterial).uniforms.uOpacity!.value = light * (0.4 + game * 0.15);
    (this.embers.material as ShaderMaterial).uniforms.uOpacity!.value = appear(1.4, 1.2);
    (this.homeFloor.material as ShaderMaterial).uniforms.uOpacity!.value = world;
    const ring = (this.energyRing.material as ShaderMaterial).uniforms.uOpacity!;
    const pulse = 0.45 + Math.sin(time * 2.2) * 0.1;
    ring.value = Math.max(game * pulse, ring.value - dt * 2);
    this.energyRing.scale.setScalar(1 + (ring.value - game * pulse) * 0.25);
  }

  private updateCollection(v: View, still: boolean): void {
    const { time, dt } = v;
    const target = -this.selected * STEP;
    let diff = target - this.ringAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.ringAngle += diff * (1 - Math.exp(-dt * (still ? 60 : 3.6)));
    const settled = smoothstep(0.35, 1.1, time - this.selectedAt);
    // на широком экране справа — текст: коты с той стороны уходят в тень, чтобы не спорить с ним
    const wide = landscapeness(this.width / this.height);
    for (const [i, figure] of this.figures.entries()) {
      const a = i * STEP + this.ringAngle;
      const front = (Math.cos(a) + 1) / 2;
      const chosen = i === this.selected ? settled : 0;
      const r = RING_R + chosen * 0.55;
      const x = COLLECTION.x + Math.sin(a) * r;
      const z = COLLECTION.z + Math.cos(a) * r;
      figure.group.position.set(x, 0.08, z);
      figure.group.scale.setScalar(0.7 + 0.3 * front ** 1.3);
      const behindText = wide * smoothstep(0.1, 0.6, Math.sin(a)) * (1 - chosen);
      figure.dim = (0.26 + 0.74 * front ** 1.6) * (1 - behindText * 0.7);
      figure.opacity = (0.35 + 0.65 * smoothstep(0, 0.45, front)) * (1 - behindText * 0.9);
      figure.reveal = 1;
      figure.update(time + i * 1.7, dt, still);
      figure.material.uniforms.uRimStrength.value = 0.5 + chosen * 0.6;
      const pedestal = this.pedestals[i]!;
      pedestal.position.set(x, 0.03, z);
      pedestal.scale.setScalar(figure.group.scale.x);
      (pedestal.material as ShaderMaterial).uniforms.uOpacity!.value =
        (0.15 + front ** 2 * 0.6 + chosen * 0.25) * (1 - behindText);
    }
    const col = this.column.material as ShaderMaterial;
    col.uniforms.uTint!.value.copy(this.catTint);
    col.uniforms.uTintMix!.value = 0.7;
    (this.beam.material as ShaderMaterial).uniforms.uColor!.value.copy(this.catTint);
    // смена мира: новый проявляется, прежний гаснет
    for (const [i, bd] of this.backdrops.entries()) {
      const front = i === this.backdropFront && bd.id !== null;
      bd.fade = front ? Math.min(1, bd.fade + dt / 1.3) : Math.max(0, bd.fade - dt / 0.9);
      bd.material.uniforms.uOpacity!.value = easeInOut(bd.fade);
      bd.material.uniforms.uDim!.value = 0.5;
      bd.material.uniforms.uSoft!.value = 1.5;
      bd.mesh.visible = bd.fade > 0.001;
    }
  }

  private updateUpgrades(v: View, still: boolean): void {
    const { time, dt } = v;
    this.engineer.reveal = 1;
    this.engineer.update(time, dt, still);
    // монеты летят по дуге вокруг Токсика, но не там, где текст: на широком экране — справа и сверху,
    // на телефоне (текст снизу) — сверху
    const wide = landscapeness(this.width / this.height);
    // широкий экран: от правого нижнего до левого верхнего (−60°…120°), телефон: верхняя дуга (−10°…190°)
    const center = ((30 + (1 - wide) * 60) * Math.PI) / 180;
    const span = ((180 + (1 - wide) * 20) * Math.PI) / 180;
    const n = this.tokenCards.length;
    for (const card of this.tokenCards) {
      const i = card.userData.index as number;
      const sway = still ? 0 : Math.sin(time * 0.18 + i * 1.3) * 0.12;
      const a = center + span * (((i * 7) % n) / (n - 1) - 0.5) + sway;
      const radius = 2.9 + wide * 0.8 + (i % 3) * 0.45;
      const z = UPGRADES.z + 4 - i * 1.15;
      card.position.set(Math.cos(a) * radius, 2.3 + Math.sin(a) * radius * (0.58 + wide * 0.04), z);
      // карточка повёрнута к оси полёта, чуть покачивается
      card.lookAt(0, 2.3, z + 7);
      card.rotation.z += Math.sin(time * 0.5 + i) * 0.05;
    }
  }

  private updateEarn(v: View, still: boolean): void {
    const { time, dt } = v;
    this.nomad.reveal = 1;
    this.nomad.update(time, dt, still);
    const spin = still ? 0 : time * 0.12;
    for (const [i, coin] of this.rewardCoins.entries()) {
      const a = i * 0.72 + spin;
      coin.position.set(EARN.x + Math.cos(a) * 2.1, 0.45 + i * 0.42, EARN.z + Math.sin(a) * 1.5);
      coin.rotation.set(Math.PI / 2, 0, 0);
      coin.rotateZ(still ? 0 : time * 0.8 + i);
    }
  }

  private updateAirdrop(v: View, still: boolean): void {
    const { time, pos } = v;
    const t = still ? 0 : time;
    this.coin.rotation.y = t * 0.45;
    this.coin.position.y = AIRDROP.y + Math.sin(t * 0.9) * 0.12;
    for (const [i, ring] of this.gyro.entries()) {
      ring.rotation.set(t * (0.12 + i * 0.05) + i, t * (0.09 - i * 0.04) + i * 0.7, 0);
    }
    const here = nearness(pos, 5);
    const progress = this.progressRing.material as ShaderMaterial;
    const filled = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
    const current = progress.uniforms.uProgress!;
    current.value += (filled * here - current.value) * (1 - Math.exp(-v.dt * 1.8));
    // кольцо без тумана: издалека (с соседней станции) его не видно
    progress.uniforms.uOpacity!.value = clamp01(1.6 - Math.abs(pos - 5) * 1.6);
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointer);
    this.renderer.dispose();
  }
}

function catById(id: string): SiteCat {
  return CATS.find((c) => c.id === id)!;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function stepSpring(s: { x: number; y: number; vx: number; vy: number }, dt: number): void {
  s.vx += (-90 * s.x - 9 * s.vx) * dt;
  s.vy += (-90 * s.y - 9 * s.vy) * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/** Карточка актива: стекло, монета токена из игры, тикер и категория. */
function tokenCard(coin: HTMLCanvasElement, ticker: string, group: string): HTMLCanvasElement {
  const W = 520;
  const H = 676;
  const [canvas, ctx] = makeCanvas(W, H);
  const r = 44;
  const path = () => {
    ctx.beginPath();
    ctx.roundRect(6, 6, W - 12, H - 12, r);
  };
  path();
  const glass = ctx.createLinearGradient(0, 0, W, H);
  glass.addColorStop(0, 'rgba(40,52,48,0.86)');
  glass.addColorStop(1, 'rgba(10,16,14,0.9)');
  ctx.fillStyle = glass;
  ctx.fill();
  const shine = ctx.createRadialGradient(W * 0.5, H * 0.3, 10, W * 0.5, H * 0.3, W * 0.7);
  shine.addColorStop(0, 'rgba(160,255,120,0.22)');
  shine.addColorStop(1, 'rgba(160,255,120,0)');
  ctx.fillStyle = shine;
  ctx.fill();
  path();
  const edge = ctx.createLinearGradient(0, 0, W, H);
  edge.addColorStop(0, 'rgba(212,255,90,0.85)');
  edge.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  edge.addColorStop(1, 'rgba(125,255,58,0.6)');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.drawImage(coin, W / 2 - 130, 92, 260, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '700 78px "Unbounded Variable", "Arial Black", sans-serif';
  ctx.fillText(ticker, W / 2, 470);
  ctx.fillStyle = 'rgba(220,255,200,0.62)';
  ctx.font = '500 26px "JetBrains Mono Variable", monospace';
  ctx.fillText(group.toUpperCase(), W / 2, 520);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 3 ? 'rgba(212,255,90,0.9)' : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 150 + i * 62, 580, 52, 10, 5);
    ctx.fill();
  }
  return canvas;
}
