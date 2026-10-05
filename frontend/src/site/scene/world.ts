import {
  CylinderGeometry,
  ColorManagement,
  Color,
  Group,
  LinearSRGBColorSpace,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { CATS, HERO_CAT, STRONGEST_CAT, catArt, catById, type CatArt, type SiteCat } from '../cats';
import { AIRDROP_REQS, FLOATING_ASSETS } from '../content';
import { calm, clamp01, introPhase, nearness, smoothstep, type View } from '../timeline';
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
  noiseCanvas,
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
/** собственная частота пружины поворота кольца коллекции, рад/с (~1.3 с на соседа) */
const RING_OMEGA = 3.4;

/** Где стоят площадки сцены (одна площадка может снимать несколько секций). */
const HOME = new Vector3(0, 0, 0);
const WORLD = new Vector3(0, 0, -52);
const PROGRESSION = new Vector3(0, 0, -104);
const COLLECTION = new Vector3(0, 0, -152);
const RING_R = 4.7;
const AIRDROP = new Vector3(0, 3.1, -200);
const FINAL = new Vector3(0, 0, -250);
const ROADMAP = new Vector3(0, 0, -300);
const COMMUNITY = new Vector3(0, 0, -350);

/**
 * Площадка каждой станции (секции страницы): у каждой секции своя — ни один кот не стоит в центре двух экранов.
 * Группы сцены: 0 главная (Инферно), 1 коллекция (кольцо), 2 проект (Странник), 3 игра (Токсик), 4 монета PAW
 * (airdrop и прогресс), 5 roadmap (маяки), 6 сообщество (коты вместе), 7 партнёрство (Galaxy Emperor в портале).
 */
const LOC = [0, 2, 3, 1, 4, 7, 5, 6] as const;
const LOCATIONS = 8;
/** станции, где тапают Токсика (демо игры), где выбирают кота и где заполняется кольцо airdrop */
const PLAY = 2;
const CATS_AT = 3;
const AIRDROP_AT = 4;

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

const SHOTS: Shot[] = [
  // главная: Инферно справа, слева — заголовок; на телефоне кот между заголовком и кнопками
  {
    target: v3(0, 1.6, 0),
    dir: v3(0, 0.05, 1),
    fit: [3, 4.4],
    fitPortrait: [2.75, 5.5],
    shift: [0.23, 0],
    shiftPortrait: [0, -0.1],
  },
  // мир и история: Странник на краю своего мира слева, текст — справа
  {
    target: v3(0, 2.1, WORLD.z),
    dir: v3(-0.14, 0.05, 1),
    fit: [5, 5.4],
    fitPortrait: [4.2, 8.4],
    shift: [-0.2, 0],
    shiftPortrait: [0, -0.06],
  },
  // как играть: Токсик среди летящих карточек-активов справа (его можно тапать), текст — слева
  {
    target: v3(0, 2.1, PROGRESSION.z),
    dir: v3(0.16, 0.06, 1),
    fit: [7.6, 6.2],
    fitPortrait: [5.2, 9.4],
    shift: [0.19, 0],
    shiftPortrait: [0, -0.06],
  },
  // персонажи и коллекция: выбранный кот впереди кольца слева, карточка — справа
  {
    target: v3(0, 1.62, COLLECTION.z + RING_R),
    dir: v3(0, 0.1, 1),
    fit: [4, 4.7],
    fitPortrait: [3.6, 7.4],
    shift: [-0.17, 0],
    shiftPortrait: [0, -0.06],
  },
  // airdrop и прогресс: камера облетает монету — кольцо прогресса справа, широкая колонка — слева
  {
    target: AIRDROP.clone(),
    dir: v3(-0.08, 0.05, 1),
    fit: [9, 13.5],
    fitPortrait: [9, 15],
    shift: [0.35, 0],
    shiftPortrait: [0, -0.06],
  },
  // партнёрство: Galaxy Emperor в портале справа, текст — слева
  {
    target: v3(0, 1.85, FINAL.z),
    dir: v3(0.1, 0.06, 1),
    fit: [3.6, 5.4],
    fitPortrait: [3, 7.2],
    shift: [0.24, 0],
    shiftPortrait: [0, -0.06],
  },
  // roadmap: маяки фаз уходят вдаль, камера сбоку и сверху
  {
    target: v3(0, 1.3, ROADMAP.z - 8),
    dir: v3(0.62, 0.42, 1),
    fit: [8, 7.4],
    fitPortrait: [6.4, 12],
    shift: [0, -0.02],
    shiftPortrait: [0, -0.06],
  },
  // сообщество и FAQ: коты вместе слева, текст — справа
  {
    target: v3(0, 1.5, COMMUNITY.z),
    dir: v3(-0.4, 0.4, 1),
    // широкая колонка справа (каналы и вопросы) — коты левее и чуть дальше, чтобы текст их не перекрывал
    fit: [16, 8.8],
    fitPortrait: [9, 14],
    shift: [-0.31, 0],
    shiftPortrait: [0, -0.06],
  },
];

/** Дуги перелётов: камера поднимается, уходит в сторону — пространство раскрывается по пути. */
const LEGS: Leg[] = [
  { arc: v3(-3, 2.5, 0) },
  { arc: v3(3.5, 1.5, 0) },
  { arc: v3(-3.8, 3, 0) },
  { arc: v3(0, 5.5, 0) },
  { arc: v3(-3.2, 3, 0) },
  { arc: v3(3, 3, 0) },
  { arc: v3(0, 4, 0) },
];

/** Тон пространства у станций ('' — тон мира выбранного кота). */
const STATION_FOG = ['#0d0603', '#130b06', '#030a06', '', '#07051a', '#070519', '#04070f', '#08060d'];

const DUST_ZONES: DustZone[] = [
  {
    center: v3(0, 3, -2),
    size: v3(26, 14, 22),
    colors: ['#ff9a4d', '#ffcf8a', '#ff5e2b', '#ffffff'],
    share: 0.13,
  },
  { center: v3(2, 4, -26), size: v3(20, 14, 34), colors: ['#cfd6ff', '#ffffff', '#9fb0ff'], share: 0.08 },
  { center: v3(0, 3.5, -52), size: v3(24, 14, 22), colors: ['#ffc93c', '#ffe08a', '#f2a65a'], share: 0.08 },
  { center: v3(-1, 3, -78), size: v3(20, 12, 28), colors: ['#c8f7ff', '#ffffff'], share: 0.05 },
  {
    center: v3(0, 3, -104),
    size: v3(26, 14, 24),
    colors: ['#7dff3a', '#d4ff5a', '#7ce9df', '#ffffff'],
    share: 0.09,
  },
  { center: v3(1, 3, -128), size: v3(20, 12, 26), colors: ['#ffe9b8', '#ffffff'], share: 0.04 },
  { center: v3(0, 3, -152), size: v3(30, 14, 28), colors: ['#ffffff', '#d9d2ff'], share: 0.12 },
  { center: v3(0, 5, -176), size: v3(20, 16, 26), colors: ['#c9b8ff', '#ffffff'], share: 0.03 },
  {
    center: v3(0, 4, -199),
    size: v3(28, 18, 26),
    colors: ['#a66bff', '#7fe3ff', '#ffffff', '#ffc93c'],
    share: 0.1,
  },
  { center: v3(0, 3, -226), size: v3(20, 14, 26), colors: ['#c9e6ff', '#ffffff'], share: 0.03 },
  { center: v3(0, 3, -300), size: v3(24, 12, 30), colors: ['#ffc93c', '#7fe3ff', '#ffffff'], share: 0.07 },
  { center: v3(0, 3, -350), size: v3(28, 14, 26), colors: ['#ffffff', '#ffd9a0', '#c9b8ff'], share: 0.09 },
  {
    center: v3(0, 3.5, -250),
    size: v3(24, 14, 22),
    colors: ['#9b7bff', '#ffd98f', '#ffffff'],
    share: 0.09,
  },
];

const STREAK_ZONES: DustZone[] = [
  { center: v3(2, 4, -26), size: v3(18, 14, 40), colors: [], share: 0.16 },
  { center: v3(-1, 3, -78), size: v3(18, 12, 40), colors: [], share: 0.14 },
  { center: v3(1, 3, -128), size: v3(18, 12, 40), colors: [], share: 0.12 },
  { center: v3(0, 5, -176), size: v3(18, 16, 40), colors: [], share: 0.14 },
  { center: v3(0, 4, -226), size: v3(18, 14, 40), colors: [], share: 0.14 },
  { center: v3(0, 4, -276), size: v3(18, 14, 40), colors: [], share: 0.15 },
  { center: v3(0, 4, -326), size: v3(18, 14, 40), colors: [], share: 0.15 },
];

/**
 * Коты сообщества: стоят вместе полукругом. Только те, кого нет в центре других экранов (Инферно — главная,
 * Странник — проект, Токсик — игра, Stealth Assassin — коллекция, Galaxy Emperor — партнёрство).
 */
const CREW = ['sakura_blossom', 'ocean_guardian', 'crystal_prince', 'cyber_samurai', 'lunar_witch'] as const;
/** Маяки фаз roadmap: цвет и яркость (последняя — неизвестность). */
const BEACONS: Array<[string, number]> = [
  ['#ffc93c', 1],
  ['#7fe3ff', 0.8],
  ['#a66bff', 0.55],
  ['#ffffff', 0.22],
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
  private lastFrameAt = 0;
  /** выше этого качество не поднимается (на нём кадры уже были долгими) */
  private ceiling = Infinity;
  private downs = 0;
  private touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  private glow: Texture;
  private ray: Texture;
  private ring: Texture;
  /** бесшовный шум мокрого пола */
  private noise: Texture;

  /** площадки сцены (LOC) */
  private stations: Group[] = [];
  private fadeables: Array<Array<{ u: { value: number }; base: number }>> = [];
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
  private ringVel = 0;
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

  // мир, прогресс, airdrop
  private nomad: CatFigure;
  private nomadBackdrop: Backdrop;
  private engineer: CatFigure;
  private tokenCards: Mesh[] = [];
  private coin: Group;
  private gyro: Mesh[] = [];
  private progressRing: Mesh;
  private vortex: ReturnType<typeof createFlow>;
  private fall: ReturnType<typeof createFlow>;

  // roadmap, сообщество, финал
  private beacons: Array<{ ring: Mesh; ray: Mesh; orb: Mesh; base: number }> = [];
  private crew: CatFigure[] = [];
  private finalCat: CatFigure;
  private finalBackdrop: Backdrop;
  private finalPortal: Mesh[] = [];

  /** близость станции персонажей (наезд камеры при смене кота — только там) */
  private atCats = 0;
  private offset = new Vector3();
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private camPush = { x: 0, v: 0 };
  private fog = new Color();
  private tmpColor = new Color();
  private lastPos = new Vector3();
  private velocity = new Vector3();
  private readyAt = -1;
  private away = new Array<number>(LOCATIONS).fill(Infinity);

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
    // тяжёлая загрузка текстур — в моменты, когда камера стоит (не посреди перелёта)
    // (первый экран — без ожидания: камера ещё не двигалась, ждать нечего)
    this.bank = new TextureBank(this.renderer, () => (this.readyAt >= 0 ? calm() : Promise.resolve()));

    this.glow = this.bank.canvas(glowCanvas());
    this.ray = this.bank.canvas(rayCanvas());
    this.ring = this.bank.canvas(ringCanvas());
    this.noise = this.bank.canvas(noiseCanvas(), false);
    this.noise.wrapS = this.noise.wrapT = RepeatWrapping;
    // режим повтора применяется при загрузке — маленькая текстура загружается заново уже с ним
    this.noise.needsUpdate = true;

    for (let i = 0; i < LOCATIONS; i++) {
      const g = new Group();
      this.stations.push(g);
      this.scene.add(g);
    }

    const scale = this.lite ? 0.45 : matchMedia('(pointer: coarse)').matches ? 0.6 : 1;
    this.dust = createDust(Math.round(6400 * scale), DUST_ZONES);
    this.streaks = createStreaks(Math.round(1000 * scale), STREAK_ZONES);
    this.dust.renderOrder = 15;
    this.streaks.renderOrder = 16;
    this.scene.add(this.dust, this.streaks, this.bursts.points);

    // ── главная / игра ──
    const home = this.stations[0]!;
    this.hero = new CatFigure(HERO_CAT, CAT_H, this.glow);
    this.heroBackdrop = this.makeBackdrop(home);
    this.homeFloor = this.makeFloor(home, HOME, 18, HERO_CAT.accent, 0.55);
    this.halo = this.glowPlane(home, '#ff6a1a', 7, v3(0, 2.3, -1.6), 0.4);
    const portal = new Mesh(new TorusGeometry(2.25, 0.04, 12, 200), glassMaterial('#ff9a4d', '#ffe0a8'));
    portal.position.set(0, 1.9, -1.3);
    const inner = new Mesh(new TorusGeometry(2.02, 0.012, 8, 200), glassMaterial('#ffb36b', '#fff1d6'));
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
    home.add(this.hero.group);

    // ── коллекция ──
    const collection = this.stations[1]!;
    this.backdrops = [this.makeBackdrop(collection), this.makeBackdrop(collection)];
    this.makeFloor(collection, COLLECTION, 32, '#ffffff', 0.25);
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

    // ── мир: Странник на краю своего мира ──
    const world = this.stations[2]!;
    this.nomadBackdrop = this.makeBackdrop(world);
    this.nomad = new CatFigure(catById('desert_nomad'), CAT_H, this.glow);
    this.nomad.group.position.copy(WORLD);
    world.add(this.nomad.group);
    this.makeFloor(world, WORLD, 18, '#f2a65a', 0.5);
    this.glowPlane(world, '#ffb36b', 8, v3(WORLD.x, 2.6, WORLD.z - 1.4), 0.22);

    // ── прогресс ──
    const progression = this.stations[3]!;
    this.engineer = new CatFigure(catById('toxic'), CAT_H, this.glow);
    this.engineer.group.position.copy(PROGRESSION);
    progression.add(this.engineer.group);
    this.makeFloor(progression, PROGRESSION, 18, '#7dff3a', 0.5);
    this.flatGlow(progression, this.ring, '#7dff3a', 4.4, v3(PROGRESSION.x, 0.02, PROGRESSION.z), 0.55);
    const sparks = createFlow({
      count: this.lite ? 120 : 260,
      mode: 'rise',
      center: v3(PROGRESSION.x, 0, PROGRESSION.z - 0.8),
      radius: 3.2,
      height: 6,
      speed: 1.1,
      size: 0.055,
      colors: ['#7dff3a', '#d4ff5a', '#ffffff'],
    });
    sparks.renderOrder = 14;
    progression.add(sparks);
    // кольцо энергии под Токсиком: вспыхивает от тапа
    this.energyRing = this.flatGlow(
      progression,
      this.ring,
      '#ffc93c',
      4.2,
      v3(PROGRESSION.x, 0.025, PROGRESSION.z),
      0,
    );

    const relief = this.bank.canvas(pawReliefCanvas());
    const face = goldMaterial(relief, false);
    const side = goldMaterial(null, true);

    // ── airdrop ──
    const airdrop = this.stations[4]!;
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
      const ring = new Mesh(new TorusGeometry(r, 0.028, 10, 220), glassMaterial(a, b));
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

    // ── roadmap: маяки фаз уходят вдаль ──
    const roadmap = this.stations[5]!;
    this.makeFloor(roadmap, v3(ROADMAP.x, 0, ROADMAP.z - 8), 30, '#7fe3ff', 0.18);
    for (const [i, [color, base]] of BEACONS.entries()) {
      const at = v3(ROADMAP.x + (i % 2 ? 1.3 : -1.3), 0, ROADMAP.z - i * 5.2);
      const ring = this.flatGlow(roadmap, this.ring, color, 3.4, v3(at.x, 0.03, at.z), 0.9 * base);
      const ray = new Mesh(new PlaneGeometry(1, 1), glowMaterial(this.ray, color, 0.6 * base));
      ray.scale.set(1.6, 9, 1);
      ray.rotation.z = Math.PI;
      ray.position.set(at.x, 4.2, at.z);
      ray.renderOrder = 2;
      roadmap.add(ray);
      const orb = this.glowPlane(roadmap, color, 2.6, v3(at.x, 1.1, at.z), base);
      this.beacons.push({ ring, ray, orb, base });
    }
    const trail = createFlow({
      count: this.lite ? 120 : 260,
      mode: 'rise',
      center: v3(ROADMAP.x, 0, ROADMAP.z - 8),
      radius: 4,
      height: 5,
      speed: 0.7,
      size: 0.05,
      colors: ['#ffc93c', '#7fe3ff', '#ffffff'],
    });
    trail.renderOrder = 14;
    roadmap.add(trail);

    // ── сообщество: коты стоят вместе ──
    const community = this.stations[6]!;
    this.makeFloor(community, COMMUNITY, 30, '#ffd9a0', 0.3);
    this.glowPlane(community, '#c9b8ff', 14, v3(COMMUNITY.x, 2.4, COMMUNITY.z - 2.4), 0.14);
    for (const [i, id] of CREW.entries()) {
      const figure = new CatFigure(catById(id), CAT_H, this.glow);
      const k = i - (CREW.length - 1) / 2;
      figure.group.position.set(COMMUNITY.x + k * 2.15, 0.02, COMMUNITY.z - Math.abs(k) * 0.9);
      figure.group.scale.setScalar(1 - Math.abs(k) * 0.07);
      this.crew.push(figure);
      community.add(figure.group);
    }

    // ── финал: самый сильный кот в портале ──
    const final = this.stations[7]!;
    this.finalBackdrop = this.makeBackdrop(final);
    this.finalCat = new CatFigure(STRONGEST_CAT, CAT_H, this.glow);
    this.finalCat.group.position.copy(FINAL);
    final.add(this.finalCat.group);
    this.makeFloor(final, FINAL, 18, STRONGEST_CAT.accent, 0.5);
    this.glowPlane(final, STRONGEST_CAT.accent, 8, v3(FINAL.x, 2.3, FINAL.z - 1.6), 0.36);
    const outer = new Mesh(new TorusGeometry(2.3, 0.04, 12, 200), glassMaterial('#9b7bff', '#ffd98f'));
    outer.position.set(FINAL.x, 1.95, FINAL.z - 1.3);
    const ring2 = new Mesh(new TorusGeometry(2.06, 0.012, 8, 200), glassMaterial('#c9b8ff', '#fff1d6'));
    ring2.position.copy(outer.position);
    (ring2.material as ShaderMaterial).uniforms.uSpeed!.value = -0.9;
    this.finalPortal = [outer, ring2];
    for (const m of this.finalPortal) {
      m.renderOrder = 3;
      final.add(m);
    }
    const stardust = createFlow({
      count: this.lite ? 140 : 300,
      mode: 'spiral',
      center: v3(FINAL.x, -0.4, FINAL.z - 0.6),
      radius: 2.6,
      height: 7,
      speed: 0.8,
      size: 0.055,
      colors: ['#9b7bff', '#ffd98f', '#ffffff'],
    });
    stardust.renderOrder = 14;
    final.add(stardust);

    // свет мира на персонажах: низ подсвечен цветом пола их станции
    this.hero.setAmbient(new Color(HERO_CAT.accent), 0.16);
    for (const f of this.figures) f.setAmbient(new Color(f.cat.accent), 0.12);
    this.engineer.setAmbient(new Color('#7dff3a'), 0.14);
    this.nomad.setAmbient(new Color('#f2a65a'), 0.14);
    for (const f of this.crew) f.setAmbient(new Color(f.cat.accent), 0.12);
    this.finalCat.setAmbient(new Color(STRONGEST_CAT.accent), 0.16);
    this.collectFadeables();

    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  // ───────────────────────────── построение ─────────────────────────────

  /** Прозрачность свечений и частиц площадок (кроме главной и котов): ими управляет близость станции. */
  private collectFadeables(): void {
    for (let i = 1; i < LOCATIONS; i++) {
      // уже известные — с прежней исходной прозрачностью (текущая могла быть приглушена)
      const list: Array<{ u: { value: number }; base: number }> = [...(this.fadeables[i] ?? [])];
      this.stations[i]!.traverse((o) => {
        const m = (o as Mesh).material as ShaderMaterial | undefined;
        const u = m?.uniforms?.uOpacity as { value: number } | undefined;
        if (!u || m!.uniforms.uReveal || list.some((f) => f.u === u)) return;
        list.push({ u, base: u.value });
      });
      this.fadeables[i] = list;
    }
  }

  private makeBackdrop(parent: Group): Backdrop {
    const material = backdropMaterial();
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.visible = false;
    mesh.renderOrder = 0;
    parent.add(mesh);
    return { mesh, material, id: null, fade: 0 };
  }

  private makeFloor(parent: Group, at: Vector3, size: number, pool: string, strength: number): Mesh {
    const material = floorMaterial(this.noise);
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

  /** Персонаж — всегда самый чёткий файл (на слабом устройстве — средний): кот главный на экране. */
  private charPx(): number {
    return this.lite ? Math.min(600, window.innerHeight * 0.68) : Number.POSITIVE_INFINITY;
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

  /**
   * Первый экран: только главный кот и его мир — вступление начинается, как только они готовы. Шейдеры всех
   * станций компилируются заранее (программы общие, текстуры для этого не нужны) — при прокрутке не дёргается.
   */
  async load(): Promise<void> {
    let done = 0;
    const step = <T>(job: Promise<T>) => job.then((v) => (this.options.onProgress(++done / 2), v));
    await Promise.all([step(this.loadCat(this.hero)), step(this.setBackdrop(this.heroBackdrop, HERO_CAT))]);
    this.placeBackdrop(this.heroBackdrop, catArt(HERO_CAT.id), HOME, 10, v3(0, 1.6, 7));
    this.hero.reveal = 0;
    await this.precompile();
  }

  /**
   * Остальное — в фоне, пока виден первый экран, в порядке прокрутки: проект, игра, коллекция, партнёрство.
   * По одной станции за раз — телефон не декодирует десяток картинок одновременно. Кот, чья текстура ещё
   * не пришла, просто не рисуется (появится, как только загрузится).
   */
  async loadRest(): Promise<void> {
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const texture = (id: string) => this.bank.art(id, 'character', this.charPx(), this.ratio);
    const dress = async (figure: CatFigure) =>
      figure.setTexture(await texture(figure.cat.id), catArt(figure.cat.id));
    await Promise.all([dress(this.nomad), this.setBackdrop(this.nomadBackdrop, this.nomad.cat)]);
    this.placeBackdrop(this.nomadBackdrop, catArt(this.nomad.cat.id), WORLD, 11, v3(0, 2, WORLD.z + 8));
    await Promise.all([dress(this.engineer), fonts.then(() => this.buildTokenCards())]);
    // Токсика тапают: маску силуэта — заранее, в фоне (у остальных котов её нет вовсе)
    void this.engineer.prepareHit();
    // карточки активов — новые материалы: шейдер и прозрачность (близость станции) — сразу
    this.collectFadeables();
    this.compileStation(LOC[PLAY]);
    for (const figure of this.figures) await dress(figure);
    await this.showSelected();
    await Promise.all([dress(this.finalCat), this.setBackdrop(this.finalBackdrop, STRONGEST_CAT)]);
    this.placeBackdrop(this.finalBackdrop, catArt(STRONGEST_CAT.id), FINAL, 10, v3(0, 1.8, FINAL.z + 7));
    for (const figure of this.crew) await dress(figure);
  }

  /** Шейдеры одной площадки — синхронно, в одном кадре (между кадрами площадка не мелькает). */
  private compileStation(index: number): void {
    const group = this.stations[index]!;
    const shown = group.visible;
    group.visible = true;
    this.renderer.compile(group, this.camera, this.scene);
    group.visible = shown;
  }

  /** Шейдеры всех станций — заранее (станции временно видимы), иначе первый показ станции дёргается. */
  private async precompile(): Promise<void> {
    const shown = this.stations.map((g) => g.visible);
    for (const g of this.stations) g.visible = true;
    // параллельная компиляция — где браузер её умеет (Safari — нет), иначе обычная: идёт экран загрузки
    if (this.renderer.extensions.has('KHR_parallel_shader_compile'))
      await this.renderer.compileAsync(this.scene, this.camera);
    else this.renderer.compile(this.scene, this.camera);
    for (const [i, g] of this.stations.entries()) g.visible = shown[i]!;
  }

  private async buildTokenCards(): Promise<void> {
    const upgrades = this.stations[3]!;
    for (const [i, asset] of FLOATING_ASSETS.entries()) {
      const coin = await svgCanvas(tokenSvg(`token/${asset.ticker}/${asset.palette}`, 256), 256);
      const map = this.bank.canvas(tokenCard(coin, asset.ticker));
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
    this.camPush.v -= 1.6 * this.atCats;
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

  /**
   * Тап в игре: true — попал в кота. Это игровая механика: искры у пальца и импульс кольца энергии
   * на полу; сам кот не реагирует.
   */
  tap(clientX: number, clientY: number, turbo: boolean): boolean {
    const at = new Vector3();
    if (!this.hitFigure(this.engineer, clientX, clientY, at)) return false;
    at.z += 0.25;
    this.bursts.emit(
      at,
      turbo ? 18 : 10,
      turbo ? ['#ffe08a', '#d4ff5a', '#ffffff'] : ['#d4ff5a', '#ffc93c'],
      turbo ? 1.15 : 0.9,
    );
    (this.energyRing.material as ShaderMaterial).uniforms.uOpacity!.value = 1;
    return true;
  }

  private hitFigure(figure: CatFigure, clientX: number, clientY: number, at: Vector3): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return figure.ready && figure.hit(x, y, this.camera, at);
  }

  /** Рамка кота игры на экране, CSS px. */
  catRect(): { x: number; y: number; width: number; height: number } | null {
    const box = this.engineer.screenBox(this.camera);
    if (!box) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x0 = rect.left + ((box.x0 + 1) / 2) * rect.width;
    const x1 = rect.left + ((box.x1 + 1) / 2) * rect.width;
    const y0 = rect.top + ((1 - box.y1) / 2) * rect.height;
    const y1 = rect.top + ((1 - box.y0) / 2) * rect.height;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  // ───────────────────────────── кадр ─────────────────────────────

  /** Размер — как у самого холста (CSS: 100lvh), и только если он или плотность пикселей изменились. */
  resize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    if (width === this.width && height === this.height && this.renderer.getPixelRatio() === this.ratio)
      return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    globals.uPixelRatio.value = this.ratio;
  }

  /**
   * Качество под устройство: если кадры долгие — меньше пикселей, если быстрые — обратно. Каждая смена — это
   * пересоздание буфера холста (короткий рывок), поэтому без качелей: разовые зависания (загрузка текстуры)
   * не считаются, вниз — через 1 с стабильно долгих кадров, вверх — только после 20 с стабильно быстрых и не
   * выше уровня, на котором кадры уже дважды были долгими.
   */
  private govern(dt: number): void {
    // разовое зависание (загрузка текстуры, сборщик мусора, вкладка была скрыта) — не показатель устройства
    if (dt > 0.1) return;
    this.frameAvg += (dt - this.frameAvg) * 0.05;
    if (this.frameAvg > 1 / 42) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else if (this.frameAvg < 1 / 57) {
      this.fastFor += dt;
      this.slowFor = 0;
    } else {
      this.slowFor = this.fastFor = 0;
    }
    // экран ×2 и выше: не ниже 1.5 на ПК и 1.25 на телефоне (слабому телефону важнее плавность)
    const floor = this.baseRatio >= 2 ? (this.touch ? 1.25 : 1.5) : 1;
    if (this.slowFor > 1 && this.ratio > floor) {
      // первый спуск мог случиться из-за разовой нагрузки (загрузка миров) — одна попытка вернуться есть;
      // со второго раза уровень, на котором было медленно, закрыт
      this.downs++;
      this.ceiling = this.downs >= 2 ? this.ratio - 0.25 : this.ratio;
      this.ratio = Math.max(floor, this.ratio - 0.25);
      this.slowFor = 0;
      this.frameAvg = 1 / 50;
      this.resize();
    } else if (this.fastFor > 20 && this.ratio < Math.min(this.baseRatio, this.ceiling)) {
      this.ratio = Math.min(this.baseRatio, this.ceiling, this.ratio + 0.25);
      this.fastFor = 0;
      this.resize();
    }
  }

  frame(v: View, selected: number): void {
    const { pos, time, dt } = v;
    // пока сцена грузится, холст скрыт (opacity 0) — рисовать нечего, главный поток нужнее загрузке
    if (v.intro < 0) return;
    if (this.readyAt < 0) this.readyAt = time;
    // для качества — настоящее время между кадрами (dt таймлайна ограничен 0.05 с и зависаний не видит)
    const now = performance.now() / 1000;
    const raw = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1 / 60;
    this.lastFrameAt = now;
    if (time - this.readyAt > 1) this.govern(raw);
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
    // наезд камеры при смене кота — пружина с критическим затуханием, шаги по 1/120 с
    for (let i = 0, n = Math.ceil(dt / (1 / 120)); i < n; i++) {
      const h = dt / n;
      this.camPush.v += (-30 * this.camPush.x - 11 * this.camPush.v) * h;
      this.camPush.x += this.camPush.v * h;
    }
    const drift = still ? 0 : 1;
    this.offset.set(
      this.pointer.x * 0.32 * drift + Math.sin(time * 0.21) * 0.06 * drift,
      this.pointer.y * 0.18 * drift + Math.sin(time * 0.17) * 0.05 * drift + dolly * 0.22,
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
    const away = this.away.fill(Infinity);
    for (const [i, loc] of LOC.entries()) away[loc] = Math.min(away[loc]!, Math.abs(pos - i));
    // площадка рисуется, только пока камера у неё или летит к ней/от неё: соседняя площадка у стоящей камеры
    // в ~50 единицах, целиком в тумане — невидима, но стоила бы полной отрисовки (коты, миры, частицы)
    for (let i = 0; i < LOCATIONS; i++) this.stations[i]!.visible = away[i]! < 0.999;
    // свечения и частицы площадки проявляются и гаснут плавно, а не включаются вместе с ней
    for (const [i, list] of this.fadeables.entries()) {
      if (!list) continue;
      const presence = 1 - smoothstep(0.4, 0.95, away[i]!);
      for (const f of list) f.u.value = f.base * presence;
    }
    this.atCats = nearness(pos, CATS_AT);

    const reveal = introPhase(0, 1.6);
    (this.dust.material as ShaderMaterial).uniforms.uReveal!.value = reveal;
    (this.dust.material as ShaderMaterial).uniforms.uTint!.value.copy(this.catTint);
    (this.dust.material as ShaderMaterial).uniforms.uTintZ!.value = COLLECTION.z;

    if (this.stations[0]!.visible) this.updateHome(v, still);
    if (this.stations[1]!.visible) this.updateCollection(v, still);
    if (this.stations[2]!.visible) this.updateWorld(v, still);
    if (this.stations[3]!.visible) this.updateProgression(v, still);
    if (this.stations[4]!.visible) this.updateAirdrop(v, still);
    if (this.stations[5]!.visible) this.updateRoadmap(v, still);
    if (this.stations[6]!.visible) this.updateCommunity(v, still);
    if (this.stations[7]!.visible) this.updateFinal(v, still);
    this.bursts.update(dt);

    this.renderer.setClearColor(this.fog);
    this.renderer.render(this.scene, this.camera);
  }

  private fogFor(pos: number, selected: number, dt: number): void {
    const cat = CATS[selected]!;
    this.catTint.lerp(this.tmpColor.set(cat.accent), 1 - Math.exp(-dt * 2.2));
    this.catFog.lerp(this.tmpColor.set(cat.fog), 1 - Math.exp(-dt * 2.2));
    // тон перетекает между станциями по плавной кривой (без излома у станции)
    this.fog.setRGB(0, 0, 0);
    let total = 0;
    for (let i = 0; i < STATION_FOG.length; i++) {
      const t = clamp01(1 - Math.abs(pos - i));
      const w = t * t * t * (t * (t * 6 - 15) + 10);
      if (!w) continue;
      const c = STATION_FOG[i] === '' ? this.catFog : this.tmpColor.set(STATION_FOG[i]!);
      this.fog.r += c.r * w;
      this.fog.g += c.g * w;
      this.fog.b += c.b * w;
      total += w;
    }
    if (total > 0) this.fog.multiplyScalar(1 / total);
    globals.uFog.value.copy(this.fog);
  }

  private updateHome(v: View, still: boolean): void {
    const { pos, time, dt } = v;
    const home = nearness(pos, 0);
    const appear = (a: number, b: number) => easeOutCubic(introPhase(a, b));
    const light = appear(0.3, 1.6);
    const world = appear(0.8, 1.4);
    this.hero.reveal = introPhase(1.2, 1.9);
    this.hero.update(time, dt, still);
    this.hero.material.uniforms.uRimStrength.value = 0.75;
    const bd = this.heroBackdrop.material.uniforms;
    bd.uOpacity!.value = world;
    bd.uFogMix!.value = 0;
    bd.uDim!.value = 0.66;
    const ringScale = 0.7 + 0.3 * appear(0.3, 1.8);
    for (const [i, m] of this.portal.entries()) {
      m.scale.setScalar(ringScale * (1 + Math.sin(time * 0.6 + i) * 0.008));
      m.rotation.z = time * (i ? -0.05 : 0.03);
      m.rotation.x = 0.08 + Math.sin(time * 0.3) * 0.03;
      (m.material as ShaderMaterial).uniforms.uOpacity!.value = light;
    }
    for (const [i, ray] of this.rays.entries()) {
      ray.rotation.z = -0.32 + i * 0.16 + Math.sin(time * 0.25 + i * 1.7) * 0.04;
      (ray.material as ShaderMaterial).uniforms.uOpacity!.value =
        light * (0.1 + 0.05 * Math.sin(time * 0.5 + i)) * home;
    }
    (this.halo.material as ShaderMaterial).uniforms.uOpacity!.value = light * 0.4;
    (this.embers.material as ShaderMaterial).uniforms.uOpacity!.value = appear(1.4, 1.2);
    (this.homeFloor.material as ShaderMaterial).uniforms.uOpacity!.value = world;
  }

  private updateCollection(v: View, still: boolean): void {
    const { time, dt } = v;
    const target = -this.selected * STEP;
    let diff = target - this.ringAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    // кольцо поворачивается пружиной: плавный разгон и мягкая остановка, без рывка в начале
    if (still) {
      this.ringAngle += diff;
      this.ringVel = 0;
    } else {
      const steps = Math.ceil(dt / (1 / 120));
      for (let i = 0; i < steps; i++) {
        const h = dt / steps;
        const d = Math.atan2(Math.sin(target - this.ringAngle), Math.cos(target - this.ringAngle));
        this.ringVel += (RING_OMEGA * RING_OMEGA * d - 2 * RING_OMEGA * this.ringVel) * h;
        this.ringAngle += this.ringVel * h;
      }
    }
    const settled = smoothstep(0.35, 1.1, time - this.selectedAt);
    // на широком экране справа — текст: коты с той стороны уходят в тень, чтобы не спорить с ним
    const wide = landscapeness(this.width / this.height) * this.atCats;
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
      const lit = 0.26 + 0.74 * front ** 1.6;
      figure.dim = lit * (1 - behindText * 0.7);
      figure.opacity = (0.35 + 0.65 * smoothstep(0, 0.45, front)) * (1 - behindText * 0.9);
      figure.reveal = 1;
      // задняя половина кольца — мелкие тёмные коты: им хватает редкой сетки
      figure.detail = i === this.selected || front > 0.5;
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
      bd.material.uniforms.uSoft!.value = 0.7;
      bd.mesh.visible = bd.fade > 0.001;
    }
  }

  private updateWorld(v: View, still: boolean): void {
    const { time, dt } = v;
    this.nomad.reveal = 1;
    this.nomad.update(time, dt, still);
    const bd = this.nomadBackdrop.material.uniforms;
    bd.uOpacity!.value = 1;
    bd.uDim!.value = 0.62;
    bd.uSoft!.value = 0.35;
  }

  private updateProgression(v: View, still: boolean): void {
    const { time, dt } = v;
    this.engineer.reveal = 1;
    this.engineer.update(time, dt, still);
    const game = nearness(v.pos, PLAY);
    const ring = (this.energyRing.material as ShaderMaterial).uniforms.uOpacity!;
    const pulse = 0.4 + Math.sin(time * 2.2) * 0.08;
    ring.value = Math.max(game * pulse, ring.value - dt * 2);
    this.energyRing.scale.setScalar(1 + (ring.value - game * pulse) * 0.25);
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
      const z = PROGRESSION.z + 4 - i * 1.15;
      card.position.set(Math.cos(a) * radius, 2.3 + Math.sin(a) * radius * (0.58 + wide * 0.04), z);
      // карточка повёрнута к оси полёта, чуть покачивается
      card.lookAt(0, 2.3, z + 7);
      card.rotation.z += Math.sin(time * 0.5 + i) * 0.05;
    }
  }

  private updateAirdrop(v: View, still: boolean): void {
    const { time, pos } = v;
    const t = still ? 0 : time;
    // монета медленно поворачивается туда-обратно (не встаёт ребром) и чуть парит
    this.coin.rotation.y = Math.sin(t * 0.33) * 0.55 + Math.sin(t * 0.12 + 1) * 0.18;
    this.coin.position.y = AIRDROP.y + Math.sin(t * 0.9) * 0.12;
    for (const [i, ring] of this.gyro.entries()) {
      ring.rotation.set(t * (0.12 + i * 0.05) + i, t * (0.09 - i * 0.04) + i * 0.7, 0);
    }
    const here = nearness(pos, AIRDROP_AT);
    const progress = this.progressRing.material as ShaderMaterial;
    const filled = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
    const current = progress.uniforms.uProgress!;
    current.value += (filled * here - current.value) * (1 - Math.exp(-v.dt * 1.8));
    // кольцо без тумана: издалека (с соседней станции) его не видно
    progress.uniforms.uOpacity!.value = clamp01(1.6 - Math.abs(pos - AIRDROP_AT) * 1.6);
  }

  private updateRoadmap(v: View, still: boolean): void {
    const t = still ? 0 : v.time;
    for (const [i, b] of this.beacons.entries()) {
      // неизвестная фаза мерцает: то проявится, то пропадёт
      const flicker = i === 3 ? 0.55 + 0.45 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1) : 1;
      const breathe = 1 + Math.sin(t * 0.8 + i * 1.4) * 0.04;
      b.orb.scale.setScalar(breathe);
      b.ring.scale.setScalar(breathe);
      b.orb.position.y = 1.1 + Math.sin(t * 0.6 + i) * 0.08;
      b.ray.rotation.z = Math.PI + Math.sin(t * 0.3 + i) * 0.03;
      (b.orb.material as ShaderMaterial).uniforms.uOpacity!.value *= flicker;
    }
  }

  private updateCommunity(v: View, still: boolean): void {
    for (const [i, f] of this.crew.entries()) {
      f.reveal = 1;
      f.dim = 0.92;
      f.update(v.time + i * 2.3, v.dt, still);
    }
  }

  private updateFinal(v: View, still: boolean): void {
    const { time, dt } = v;
    this.finalCat.reveal = 1;
    this.finalCat.update(time, dt, still);
    this.finalCat.material.uniforms.uRimStrength.value = 0.9;
    const bd = this.finalBackdrop.material.uniforms;
    bd.uOpacity!.value = 1;
    bd.uDim!.value = 0.55;
    bd.uSoft!.value = 0.2;
    const t = still ? 0 : time;
    for (const [i, m] of this.finalPortal.entries()) {
      m.rotation.z = t * (i ? -0.05 : 0.03);
      m.rotation.x = 0.08 + Math.sin(t * 0.3) * 0.03;
    }
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onPointer);
    this.renderer.dispose();
  }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Карточка актива: стекло, монета токена из игры и тикер (без слов — сцена одна на все языки). */
function tokenCard(coin: HTMLCanvasElement, ticker: string): HTMLCanvasElement {
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
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 3 ? 'rgba(212,255,90,0.9)' : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 150 + i * 62, 580, 52, 10, 5);
    ctx.fill();
  }
  return canvas;
}
