import { formatShort, type Locale } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../../animations';
import { catMood, type CatEvent } from '../../game/catMood';
import { CatMotion } from '../../game/catMotion';
import { centerOf, confetti } from '../../game/effects';
import { onFrame } from '../../game/frameLoop';
import {
  EFFECT_PARTICLE,
  skinArt,
  skinId as knownSkin,
  skinStyle,
  skinVars,
  type ParticleKind,
} from '../../game/skins';
import { playSound } from '../../lib/sound';
import { haptic } from '../../telegram/webapp';
import { HeroFigure } from './HeroFigure';
import { heroLayout } from './layout';

export interface TapHandler {
  /** засчитать тап; false — не хватает энергии */
  tap(): boolean;
  /** монет за тап сейчас (для «+N») */
  reward(): number;
  /** кот «устал»: энергии меньше, чем стоит тап */
  sleepy(): boolean;
  turbo(): boolean;
}

interface Props {
  /** место под сцену: кот вписывается в него */
  width: number;
  height: number;
  handler: TapHandler;
  locale: Locale;
  sleepyLabel: string;
  /** надетый скин и эффект тапа */
  skinId: string;
  effectId: string;
  /** режим ввода шифра: нажатия не тратят энергию, передаются наружу с длительностью */
  onPress?: (durationMs: number) => void;
}

const FLOAT_POOL = 24;
const RING_POOL = 8;
const FLASH_POOL = 6;
const COIN_POOL = 12;
const PT_POOL = 32;
/** серия тапов прерывается паузой дольше */
const STREAK_GAP_MS = 700;
/** без тапов столько — кот засыпает */
const SLEEP_AFTER_MS = 45_000;
/** случайные спокойные действия — раз в 5–11 секунд, если не тапали хотя бы 3 секунды */
const IDLE_MIN_MS = 5_000;
const IDLE_SPREAD_MS = 6_000;
const IDLE_QUIET_MS = 3_000;
/** моргание — раз в 2,4–6,4 секунды, иногда дважды подряд */
const BLINK_MIN_MS = 2_400;
const BLINK_SPREAD_MS = 4_000;
/** прищур после тапа держится столько */
const SQUINT_MS = 260;
/** лёгкая вибрация не чаще раза в 70 мс */
const HAPTIC_GAP_MS = 70;
/** подсказка «тапни кота» — один раз, до первого тапа */
const HINT_KEY = 'meowgul.catHint';

type Reaction = 'happy' | 'excited' | 'special' | 'heart' | 'celebrate' | 'surprised' | 'annoyed' | 'sleepy';

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === 'done';
  } catch {
    return true;
  }
}

/**
 * Главная сцена: надетый персонаж — он и есть кнопка игры. Тап по нему → существующая логика награды
 * (handler.tap → tapEngine: энергия, баланс, множители) → лёгкая реакция лица и эффекты вокруг.
 *
 * Тап персонажа НЕ двигает: ни прыжков, ни сжатия, ни тряски. На тап отвечают только лицо (короткий
 * прищур, взгляд в сторону пальца) и интерфейс: «+N», круги, искры, частицы, аура.
 * Покой и тап разделены полностью: в покое персонаж дышит (CSS-цикл от ступней), моргает, водит глазами,
 * иногда наклоняет голову или смотрит на лапы и медленно меняет позу (поворот в перспективе) — тапы эти
 * циклы не трогают. Всё — transform/opacity. Смена скина — персонаж мягко проявляется, обработчики остаются.
 */
export function HeroStage({ width, height, handler, locale, sleepyLabel, skinId, effectId, onPress }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const effectRef = useRef<ParticleKind>(EFFECT_PARTICLE[effectId] ?? 'coin');
  effectRef.current = EFFECT_PARTICLE[effectId] ?? 'coin';
  const skin = knownSkin(skinId);
  const art = skinArt(skin);
  const artRef = useRef(art);
  artRef.current = art;
  const burstRef = useRef<ParticleKind>(skinStyle(skin).burst);
  burstRef.current = skinStyle(skin).burst;
  const L = heroLayout(width, height, art.aspect, art.body);
  // раскладка — через ref: при смене размера (свернулась лига, Telegram развернул окно) обработчики,
  // физика и начатое нажатие остаются
  const layoutRef = useRef(L);
  layoutRef.current = L;

  useEffect(() => {
    const root = rootRef.current;
    const hit = hitRef.current;
    const fx = fxRef.current;
    if (!root || !hit || !fx) return;
    const reduced = () => isReducedMotion();

    // ── смена позы в покое: медленный поворот в объёме на пружинах (тапы его не трогают) ──
    const motion = new CatMotion();
    let yawNow = 0;
    let pitchNow = 0;
    let raf = 0;
    let last = 0;
    const apply = () => {
      const t = motion.transforms();
      // объём: угол поворота — переменными, по ним CSS двигает перспективу, глубину слоёв, свет и тень
      if (t.yaw !== yawNow || t.pitch !== pitchNow) {
        yawNow = t.yaw;
        pitchNow = t.pitch;
        root.style.setProperty('--yaw', yawNow.toFixed(3));
        root.style.setProperty('--pitch', pitchNow.toFixed(3));
      }
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const active = motion.advance(dt);
      apply();
      if (active) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const kick = () => {
      if (reduced()) {
        motion.advance(10);
        apply();
        return;
      }
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    // отложенные действия лица; снимаются при размонтировании
    const pending = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        pending.delete(id);
        fn();
      }, ms);
      pending.add(id);
    };

    // ── лицо: моргание, взгляд, прищур, наклон головы ──
    /** взгляд: −1…1 по каждой оси (радужка смещается внутри глаза) */
    const gaze = (gx: number, gy: number) => {
      root.style.setProperty('--gx', Math.max(-1, Math.min(1, gx)).toFixed(3));
      root.style.setProperty('--gy', Math.max(-1, Math.min(1, gy)).toFixed(3));
    };
    let gazeBack = 0;
    /** посмотреть и через ms вернуть взгляд прямо */
    const glanceFor = (gx: number, gy: number, ms: number) => {
      gaze(gx, gy);
      window.clearTimeout(gazeBack);
      gazeBack = window.setTimeout(() => gaze(0, 0), ms);
    };
    /** моргнуть: веки сверху вниз и обратно (от текущего положения — сонный моргает из прищура) */
    const blink = (twice = false) => {
      root.querySelectorAll<HTMLElement>('.eye-lid').forEach((lid) => {
        lid.getAnimations().forEach((a) => a.cancel());
        lid.animate([{ transform: 'scaleY(1)' }], {
          duration: 75,
          direction: 'alternate',
          iterations: twice ? 4 : 2,
          easing: 'ease-in',
        });
      });
    };
    let squintTimer = 0;
    /** короткий довольный прищур — реакция лица на тап */
    const squint = (ms = SQUINT_MS) => {
      root.dataset.squint = 'true';
      window.clearTimeout(squintTimer);
      squintTimer = window.setTimeout(() => delete root.dataset.squint, ms);
    };
    let poseTimer = 0;
    /** наклон головы на время (только в покое и по событиям игры, не на тап) */
    const pose = (name: 'tilt-l' | 'tilt-r' | 'paws' | 'up', ms: number) => {
      if (reduced()) return;
      root.dataset.pose = name;
      window.clearTimeout(poseTimer);
      poseTimer = window.setTimeout(() => delete root.dataset.pose, ms);
    };

    // пулы переиспользуемых элементов — никаких тысяч DOM-нод при яростном тапании
    const make = (cls: string, n: number) =>
      Array.from({ length: n }, () => {
        const el = document.createElement('div');
        el.className = cls;
        el.style.opacity = '0';
        fx.appendChild(el);
        return el;
      });
    const floats = make('tap-float', FLOAT_POOL);
    const rings = make('tap-ring', RING_POOL);
    const flashes = make('tap-flash', FLASH_POOL);
    const coins = make('tap-coin', COIN_POOL);
    const pts = make('tap-pt pt', PT_POOL);
    let fi = 0;
    let ri = 0;
    let li = 0;
    let pi = 0;
    let taps = 0;
    const pressStarts = new Map<number, number>();

    const spawnFloat = (x: number, y: number, text: string, scale: number) => {
      const el = floats[fi++ % FLOAT_POOL]!;
      el.getAnimations().forEach((a) => a.cancel());
      el.textContent = text;
      const drift = (Math.random() - 0.5) * 40;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.75 * scale})`, opacity: 0 },
          {
            transform: `translate(${x + drift * 0.4}px, ${y - 40}px) translate(-50%, -50%) scale(${1.08 * scale})`,
            opacity: 1,
            offset: 0.25,
          },
          {
            transform: `translate(${x + drift}px, ${y - 120}px) translate(-50%, -50%) scale(${scale})`,
            opacity: 0,
          },
        ],
        { duration: DURATION.tapFloat, easing: EASING.smoothOut },
      );
    };
    const spawnRing = (x: number, y: number, scale: number) => {
      if (reduced()) return;
      const el = rings[ri++ % RING_POOL]!;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.35)`, opacity: 0.55 },
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1.25 * scale})`, opacity: 0 },
        ],
        { duration: DURATION.tapRing, easing: 'ease-out' },
      );
    };
    const spawnFlash = (x: number, y: number, scale: number) => {
      if (reduced()) return;
      const el = flashes[li++ % FLASH_POOL]!;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.4)`, opacity: 0.7 },
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`, opacity: 0 },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    };
    /** частицы эффекта тапа (надетая «косметика») */
    const spawnParticles = (x: number, y: number, count: number, kind = effectRef.current, spread = 1) => {
      if (reduced()) return;
      for (let i = 0; i < count; i++) {
        const el = pts[pi++ % PT_POOL]!;
        el.className = `tap-pt pt pt-${kind}`;
        el.textContent = kind === 'code' ? (Math.random() < 0.5 ? '0' : '1') : '';
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
        const dist = 45 + Math.random() * 45;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const rot = (Math.random() - 0.5) * 200;
        el.animate(
          [
            {
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6) rotate(0deg)`,
              opacity: 0.95,
            },
            {
              transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%) scale(1) rotate(${rot}deg)`,
              opacity: 0,
            },
          ],
          { duration: 620 + Math.random() * 220, easing: EASING.smoothOut },
        );
      }
    };
    const catCenter = () => {
      const c = layoutRef.current.cat;
      return { x: c.left + c.width / 2, y: c.top + c.height * 0.5 };
    };
    const headPoint = () => {
      const c = layoutRef.current.cat;
      return { x: c.left + c.width * artRef.current.head[0], y: c.top + c.height * artRef.current.head[1] };
    };
    const coinSalute = () => {
      const c = catCenter();
      const r = layoutRef.current.cat.width / 2;
      coins.forEach((el, i) => {
        const angle = (i / COIN_POOL) * Math.PI * 2 + Math.random() * 0.4;
        const dist = r * (1 + Math.random() * 0.5);
        el.animate(
          [
            {
              transform: `translate(${c.x}px, ${c.y}px) translate(-50%, -50%) scale(0.4) rotate(0deg)`,
              opacity: 1,
            },
            {
              transform: `translate(${c.x + Math.cos(angle) * dist}px, ${c.y + Math.sin(angle) * dist}px) translate(-50%, -50%) scale(1) rotate(${
                180 + Math.random() * 180
              }deg)`,
              opacity: 0,
            },
          ],
          { duration: 700 + Math.random() * 300, easing: EASING.smoothOut },
        );
      });
      playSound('coin');
    };

    // ── аура: короткая вспышка с перерывом ──
    let auraAt = 0;
    const auraFlash = () => {
      const now = performance.now();
      const aura = root.querySelector<HTMLElement>('.hero-aura');
      if (!aura || reduced() || now - auraAt < 320) return;
      auraAt = now;
      aura.animate([{ opacity: 1 }, { opacity: 0.6 }], { duration: 420, easing: 'ease-out' });
    };

    let mood: '' | 'sleepy' | 'excited' = '';
    let moodTimer = 0;
    const setMood = (next: typeof mood, ms = 0) => {
      mood = next;
      root.dataset.mood = next;
      window.clearTimeout(moodTimer);
      if (ms) moodTimer = window.setTimeout(() => setMood(''), ms);
    };

    // реакции — лицом и эффектами вокруг; тело остаётся на месте
    const react = (reaction: Reaction) => {
      const head = headPoint();
      switch (reaction) {
        case 'happy':
          squint(420);
          later(() => blink(), 480);
          break;
        case 'excited':
          setMood('excited', 2600);
          blink(true);
          auraFlash();
          spawnParticles(head.x, head.y, 5, 'star', 1.6);
          break;
        case 'special':
        case 'heart':
          setMood('excited', 3000);
          squint(700);
          auraFlash();
          spawnParticles(head.x, head.y, 8, 'heart', 1.8);
          break;
        case 'celebrate':
          setMood('excited', 3500);
          blink(true);
          pose('up', 1600);
          confetti(centerOf(root), 60);
          spawnParticles(head.x, head.y, 8, 'gold', 1.8);
          break;
        case 'surprised':
          // глаза широко, взгляд прямо, голова чуть набок
          delete root.dataset.squint;
          glanceFor(0, -0.4, 900);
          pose(Math.random() < 0.5 ? 'tilt-l' : 'tilt-r', 1400);
          break;
        case 'annoyed':
          // нет энергии: отводит взгляд вниз и в сторону
          glanceFor(Math.random() < 0.5 ? -0.8 : 0.8, 0.7, 1200);
          break;
        case 'sleepy':
          setMood('sleepy');
          gaze(0, 0.5);
          motion.orbitTo(0, -1.2);
          kick();
          break;
      }
    };

    // ── взгляд: глаза (не тело) следят за пальцем/курсором, через 1,6 с — снова прямо ──
    /** рамка самого персонажа на экране (зона тапа шире — с запасом для пальца) */
    const catRectNow = () => {
      const r = root.getBoundingClientRect();
      const c = layoutRef.current.cat;
      return { left: r.left + c.left, top: r.top + c.top, width: c.width, height: c.height };
    };
    const lookAt = (clientX: number, clientY: number) => {
      if (mood === 'sleepy') return;
      const rect = catRectNow();
      const eyes = headPoint();
      const dx = (clientX - (rect.left + eyes.x - layoutRef.current.cat.left)) / (rect.width * 0.5);
      const dy = (clientY - (rect.top + eyes.y - layoutRef.current.cat.top)) / (rect.height * 0.5);
      glanceFor(dx, dy, 1600);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.buttons) lookAt(e.clientX, e.clientY);
    };

    // ── серии тапов и простой ──
    let lastTap = 0;
    let streak = 0;
    let lastActivity = performance.now();
    let lastAnnoyed = 0;
    let lastHaptic = 0;
    let warnedAt = 0;
    const feel = (now: number, strong = false) => {
      if (strong) {
        haptic.impact('medium');
        lastHaptic = now;
      } else if (now - lastHaptic >= HAPTIC_GAP_MS) {
        haptic.impact('light');
        lastHaptic = now;
      }
    };
    const onStreak = (n: number) => {
      if (n === 5) react('happy');
      else if (n === 10) react('excited');
      else if (n === 20) react('special');
      else if (n > 20 && n % 25 === 0) react(Math.random() < 0.5 ? 'heart' : 'excited');
    };
    const wakeUp = () => {
      if (mood === 'sleepy') {
        setMood('');
        gaze(0, 0);
        motion.orbitTo(0, 0);
        kick();
        react('happy');
      }
    };
    let hintShown = !hintSeen();
    const dismissHint = () => {
      if (!hintShown) return;
      hintShown = false;
      hintRef.current?.setAttribute('data-hidden', 'true');
      try {
        localStorage.setItem(HINT_KEY, 'done');
      } catch {
        /* приватный режим — подсказка просто покажется ещё раз */
      }
    };

    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('[data-hit]')) return;
      // тап по коту — только игровое действие: без выделения, меню, жестов и обработчиков родителей
      e.preventDefault();
      e.stopPropagation();
      const rootRect = root.getBoundingClientRect();
      const catRect = catRectNow();
      const x = e.clientX - rootRect.left;
      const y = e.clientY - rootRect.top;
      const onHead = (e.clientY - catRect.top) / catRect.height < artRef.current.headBottom;
      const now = performance.now();
      lastActivity = now;
      lookAt(e.clientX, e.clientY);
      wakeUp();
      if (onPressRef.current) {
        pressStarts.set(e.pointerId, now);
        squint(180);
        feel(now);
        return;
      }
      const h = handlerRef.current;
      if (!h.tap()) {
        // энергии нет: награды нет, кот только устало отводит глаза
        if (now - warnedAt > 600) {
          warnedAt = now;
          haptic.notify('warning');
        }
        if (now - lastAnnoyed > 2500) {
          lastAnnoyed = now;
          react('annoyed');
        }
        return;
      }
      streak = now - lastTap < STREAK_GAP_MS ? streak + 1 : 1;
      lastTap = now;
      // серия усиливает только эффекты вокруг: 1–3 обычно, 4–9 живее, 10+ заметнее; награда — как в логике
      // игры. Сам персонаж стоит: лицо лишь чуть щурится (по голове — сильнее)
      const tier = streak >= 10 ? 3 : streak >= 4 ? 2 : 1;
      squint(onHead ? SQUINT_MS + 120 : SQUINT_MS);
      spawnFloat(
        x,
        y - 10,
        `+${formatShort(h.reward(), localeRef.current)}`,
        tier === 3 ? 1.18 : tier === 2 ? 1.08 : 1,
      );
      spawnFlash(x, y, tier === 3 ? 1.5 : 1.15);
      spawnRing(x, y, tier === 3 ? 1.35 : 1);
      spawnParticles(x, y, tier + 1);
      // всплеск в стиле персонажа: лепесток, искра, снежинка…
      spawnParticles(x, y, tier === 3 ? 2 : 1, burstRef.current, 1.3);
      if (tier >= 2) auraFlash();
      feel(now, streak === 10);
      playSound('tap');
      dismissHint();
      onStreak(streak);
      taps++;
      if (taps % 100 === 0) coinSalute();
    };
    const onUp = (e: PointerEvent) => {
      const started = pressStarts.get(e.pointerId);
      if (started === undefined) return;
      pressStarts.delete(e.pointerId);
      onPressRef.current?.(performance.now() - started);
    };
    const cancel = (e: PointerEvent) => pressStarts.delete(e.pointerId);
    const noMenu = (e: Event) => {
      if (!(e.target as HTMLElement | null)?.closest('[data-hit]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('contextmenu', noMenu);
    // клик (после pointerup) не должен дойти до родителей и вызвать их действия
    root.addEventListener('click', noMenu);
    window.addEventListener('pointermove', onMove, { passive: true });

    // спокойные действия в простое (не чаще раза в 5 с) и засыпание: глаза, голова, свет — тело на месте
    type Idle = 'glance' | 'paws' | 'tilt' | 'look-up' | 'glow';
    const IDLE: Idle[] = ['glance', 'paws', 'tilt', 'glance', 'glow', 'look-up', 'paws', 'tilt'];
    let idleTimer = 0;
    let lastIdle = -1;
    const idleAction = (a: Idle) => {
      switch (a) {
        case 'glance': {
          const dir = Math.random() < 0.5 ? -1 : 1;
          glanceFor(dir * (0.6 + Math.random() * 0.4), Math.random() * 0.4 - 0.2, 1500);
          later(() => blink(), 1700);
          break;
        }
        case 'paws':
          // посмотреть на лапы: голова вниз, глаза вниз
          pose('paws', 2400);
          glanceFor(0.15, 1, 2300);
          break;
        case 'tilt':
          pose(Math.random() < 0.5 ? 'tilt-l' : 'tilt-r', 2600);
          later(() => blink(), 900);
          break;
        case 'look-up':
          pose('up', 1800);
          glanceFor(Math.random() * 0.6 - 0.3, -1, 1700);
          break;
        case 'glow':
          auraFlash();
          blink(true);
          break;
      }
    };
    // моргание — само по себе, независимо от тапов
    let blinkTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(
        () => {
          if (!document.hidden && mood !== 'sleepy') blink(Math.random() < 0.2);
          scheduleBlink();
        },
        BLINK_MIN_MS + Math.random() * BLINK_SPREAD_MS,
      );
    };
    scheduleBlink();
    // в покое персонаж медленно поворачивается то чуть в одну, то в другую сторону — живой объём
    let orbitTimer = 0;
    const scheduleOrbit = () => {
      orbitTimer = window.setTimeout(
        () => {
          if (!document.hidden && !reduced() && performance.now() - lastActivity > 2_600) {
            if (mood === 'sleepy') motion.orbitTo(0, -1.2);
            else motion.orbitTo((Math.random() * 2 - 1) * 3.5, Math.random() * 1.2 - 0.3);
            kick();
          }
          scheduleOrbit();
        },
        3_200 + Math.random() * 3_400,
      );
    };
    scheduleOrbit();
    const scheduleIdle = () => {
      idleTimer = window.setTimeout(runIdle, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    };
    const runIdle = () => {
      const quiet = performance.now() - lastActivity;
      if (!document.hidden && !onPressRef.current) {
        if (quiet > SLEEP_AFTER_MS) {
          if (mood !== 'sleepy') react('sleepy');
        } else if (quiet > IDLE_QUIET_MS && !reduced()) {
          let i = Math.floor(Math.random() * IDLE.length);
          if (i === lastIdle) i = (i + 1) % IDLE.length;
          lastIdle = i;
          idleAction(IDLE[i]!);
        }
      }
      scheduleIdle();
    };
    scheduleIdle();

    // возвращение в игру после паузы — кот радуется
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = performance.now();
      else if (hiddenAt && performance.now() - hiddenAt > 20_000) {
        lastActivity = performance.now();
        setMood('');
        react('happy');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // события игры: покупка, новый скин, уровень, редкая награда, друг
    const REACTION: Record<CatEvent, Reaction> = {
      purchase: 'excited',
      equip: 'excited',
      levelUp: 'celebrate',
      rare: 'surprised',
      friend: 'happy',
      return: 'happy',
    };
    const offMood = catMood.on((event) => {
      lastActivity = performance.now();
      if (mood === 'sleepy') setMood('');
      react(REACTION[event]);
    });

    // «усталость» и Turbo — атрибуты для CSS, меняются только при смене состояния
    let lastSleepy: boolean | null = null;
    let lastTurbo: boolean | null = null;
    const stopFrame = onFrame(() => {
      const h = handlerRef.current;
      const sleepy = !onPressRef.current && h.sleepy();
      const turbo = h.turbo();
      if (sleepy !== lastSleepy) {
        root.dataset.sleepy = String(sleepy);
        lastSleepy = sleepy;
      }
      if (turbo !== lastTurbo) {
        root.dataset.turbo = String(turbo);
        lastTurbo = turbo;
      }
    });

    return () => {
      stopFrame();
      offMood();
      window.clearTimeout(idleTimer);
      window.clearTimeout(orbitTimer);
      window.clearTimeout(blinkTimer);
      pending.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(moodTimer);
      window.clearTimeout(gazeBack);
      window.clearTimeout(squintTimer);
      window.clearTimeout(poseTimer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('contextmenu', noMenu);
      root.removeEventListener('click', noMenu);
      [...floats, ...rings, ...flashes, ...coins, ...pts].forEach((el) => el.remove());
    };
  }, []);

  const head = { x: L.cat.left + L.cat.width * art.head[0], y: L.cat.top + L.cat.height * art.head[1] };
  return (
    <div
      ref={rootRef}
      className="hero-stage relative select-none"
      style={{ width, height, ...skinVars(skin) }}
      data-testid="hero"
      data-skin={skin}
    >
      {/* смена скина: новый персонаж мягко проявляется на том же месте */}
      <div key={skin} className="hero-enter absolute" style={{ left: L.cat.left, top: L.cat.top }}>
        <HeroFigure skinId={skin} height={L.cat.height} />
      </div>
      <div
        className="hero-zzz pointer-events-none absolute text-2xl font-black text-white/80"
        style={{ left: head.x + L.cat.width * 0.18, top: Math.max(0, head.y - L.cat.height * 0.1) }}
      >
        Zzz
      </div>
      <div
        className="hero-tired pointer-events-none absolute text-center text-sm font-extrabold text-white/90"
        style={{ left: 0, width, top: L.cat.top + L.cat.height * 0.86 }}
      >
        <span className="rounded-full bg-black/55 px-3 py-1">{sleepyLabel}</span>
      </div>
      {!hintSeen() && (
        <div
          ref={hintRef}
          className="hero-hint pointer-events-none absolute"
          style={{ left: L.cat.left + L.cat.width * art.body, top: L.cat.top + L.cat.height * 0.5 }}
          data-testid="cat-hint"
          aria-hidden
        >
          <span className="hero-hint-ring" />
          <span className="hero-hint-hand">👆</span>
        </div>
      )}
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />
      {/* зона тапа — персонаж целиком с запасом по бокам, чтобы палец попадал и у самого края */}
      <div
        ref={hitRef}
        className="hero-hit absolute"
        style={{
          left: L.hit.left,
          top: 0,
          width: L.hit.width,
          height,
          borderRadius: 28,
        }}
        data-hit="cat"
        role="button"
        aria-label={locale === 'ru' ? 'Погладить кота' : 'Pet the cat'}
        data-testid="cat-hit"
      />
    </div>
  );
}
