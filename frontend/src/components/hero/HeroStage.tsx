import { formatShort, type Locale } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../../animations';
import { catMood, type CatEvent } from '../../game/catMood';
import { CatMotion } from '../../game/catMotion';
import { centerOf, confetti } from '../../game/effects';
import { onFrame } from '../../game/frameLoop';
import { EFFECT_PARTICLE, skinRig, skinVars, type ParticleKind } from '../../game/skins';
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
/** случайные спокойные действия — раз в 6–14 секунд, если не тапали хотя бы 4 секунды */
const IDLE_MIN_MS = 6_000;
const IDLE_SPREAD_MS = 8_000;
const IDLE_QUIET_MS = 4_000;
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
 * Главная сцена: живой кот — он и есть кнопка игры. Тап по коту → существующая логика награды
 * (handler.tap → tapEngine: энергия, баланс, множители) → реакция кота и эффекты.
 *
 * Движение без рывков: спокойные покачивания (поза, дыхание, голова, хвост) — CSS-анимации на разных
 * слоях с разной длительностью; реакции на тап — пружины CatMotion на своих слоях (без наложения
 * анимаций друг на друга: тап только добавляет скорость, отклонение ограничено, кот всегда
 * возвращается точно в исходную позу). Позиция кота не меняется, всё — transform/opacity.
 */
export function HeroStage({ width, height, handler, locale, sleepyLabel, skinId, effectId, onPress }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const earRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const lidsRef = useRef<SVGSVGElement>(null);
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
  const skinRef = useRef(skinId);
  skinRef.current = skinId;
  const rig = skinRig(skinId);
  const rigRef = useRef(rig);
  rigRef.current = rig;
  const L = heroLayout(width, height, rig.aspect);
  // раскладка — через ref: при смене размера (свернулась лига, Telegram развернул окно) обработчики,
  // физика и начатое нажатие остаются
  const layoutRef = useRef(L);
  layoutRef.current = L;

  useEffect(() => {
    const root = rootRef.current;
    const bodyEl = bodyRef.current;
    const headEl = headRef.current;
    const tailEl = tailRef.current;
    const earEl = earRef.current;
    const footEl = footRef.current;
    const hit = hitRef.current;
    const fx = fxRef.current;
    if (!root || !bodyEl || !headEl || !tailEl || !earEl || !footEl || !hit || !fx) return;
    const reduced = () => isReducedMotion();

    // ── физика реакций: кадры идут, только пока пружины не успокоились ──
    const motion = new CatMotion();
    let yawNow = 0;
    let pitchNow = 0;
    let raf = 0;
    let last = 0;
    const apply = () => {
      const t = motion.transforms();
      bodyEl.style.transform = t.body;
      headEl.style.transform = t.head;
      tailEl.style.transform = t.tail;
      earEl.style.transform = t.ear;
      footEl.style.transform = t.foot;
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
    // отложенные толчки пружин (серия притопов, двойное подёргивание уха); снимаются при размонтировании
    const pending = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        pending.delete(id);
        fn();
        kick();
      }, ms);
      pending.add(id);
    };
    /** n притопов кроссовкой в ритм */
    const stomps = (n: number) => {
      if (reduced()) return;
      for (let i = 0; i < n; i++) later(() => motion.stomp(i === n - 1 ? 1 : 0.8), i * 280);
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
      return { x: c.left + c.width * rigRef.current.head.x, y: c.top + c.height * rigRef.current.head.y };
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

    // ── огоньки и аура: короткая вспышка с перерывом ──
    let ledAt = 0;
    const ledFlash = () => {
      const now = performance.now();
      if (reduced() || now - ledAt < 140) return;
      ledAt = now;
      root
        .querySelectorAll<HTMLElement>('.hero-led')
        .forEach((el) =>
          el.animate([{ opacity: 0.95 }, { opacity: 0.4 }], { duration: 300, easing: 'ease-out' }),
        );
    };
    let auraAt = 0;
    const auraFlash = () => {
      const now = performance.now();
      const aura = root.querySelector<HTMLElement>('.hero-aura');
      if (!aura || reduced() || now - auraAt < 320) return;
      auraAt = now;
      aura.animate([{ opacity: 1 }, { opacity: 0.6 }], { duration: 420, easing: 'ease-out' });
    };

    // ── веки: одна анимация за раз (новая отменяет прежнюю — без конфликтов) ──
    let mood: '' | 'sleepy' | 'excited' = '';
    let lidAnims: Animation[] = [];
    let lidAt = 0;
    const lids = (eyes: number[]) =>
      Array.from(lidsRef.current?.querySelectorAll<SVGElement>('.hero-lid, .hero-lash') ?? []).filter((el) =>
        eyes.includes(Number(el.dataset.eye)),
      );
    /** shut — насколько закрыть (1 — полностью), close/hold/open — мс */
    const eyelids = (eyes: number[], shut: number, close: number, hold: number, open: number) => {
      if (reduced() || mood === 'sleepy') return;
      lidAnims.forEach((a) => a.cancel());
      lidAnims = [];
      lidAt = performance.now();
      const duration = close + hold + open;
      const a = close / duration;
      const b = (close + hold) / duration;
      const lash = shut > 0.8 ? 1 : 0;
      for (const el of lids(eyes)) {
        const frames: Keyframe[] = el.classList.contains('hero-lash')
          ? [{ opacity: 0 }, { opacity: lash, offset: a }, { opacity: lash, offset: b }, { opacity: 0 }]
          : [
              { transform: 'scaleY(0)' },
              { transform: `scaleY(${shut})`, offset: a },
              { transform: `scaleY(${shut})`, offset: b },
              { transform: 'scaleY(0)' },
            ];
        lidAnims.push(el.animate(frames, { duration, easing: 'ease-in-out' }));
      }
    };
    const blink = () => eyelids([0, 1], 1, 70, 0, 90);
    const squint = () => {
      if (performance.now() - lidAt > 700) eyelids([0, 1], 0.45, 110, 140, 160);
    };
    const wink = () => eyelids([0], 1, 90, 220, 140);

    let moodTimer = 0;
    const setMood = (next: typeof mood, ms = 0) => {
      mood = next;
      root.dataset.mood = next;
      window.clearTimeout(moodTimer);
      if (ms) moodTimer = window.setTimeout(() => setMood(''), ms);
    };

    const react = (reaction: Reaction) => {
      const head = headPoint();
      switch (reaction) {
        case 'happy':
          squint();
          motion.swish(45);
          motion.nod(14);
          motion.twitch(1, 0.7);
          stomps(2);
          break;
        case 'excited':
          setMood('excited', 2600);
          squint();
          motion.swish(60);
          stomps(3);
          auraFlash();
          ledFlash();
          spawnParticles(head.x, head.y, 5, 'star', 1.6);
          break;
        case 'special':
        case 'heart':
          setMood('excited', 3000);
          squint();
          motion.nod(-20);
          motion.swish(70);
          auraFlash();
          spawnParticles(head.x, head.y, 8, 'heart', 1.8);
          break;
        case 'celebrate':
          setMood('excited', 3500);
          squint();
          motion.swish(70);
          stomps(4);
          confetti(centerOf(root), 60);
          spawnParticles(head.x, head.y, 8, 'gold', 1.8);
          break;
        case 'surprised':
          motion.twitch(1, 1.2);
          motion.nod(24);
          motion.swish(60);
          blink();
          break;
        case 'annoyed':
          motion.twitch(-1, 1.2);
          motion.nod(-16);
          break;
        case 'sleepy':
          setMood('sleepy');
          motion.lookAt(0, 0);
          break;
      }
      kick();
    };

    // ── взгляд: голова чуть поворачивается к пальцу/курсору, через 2,6 с — обратно ──
    let gazeTimer = 0;
    let glancing = false;
    /** рамка самого кота на экране (зона тапа шире — с запасом для пальца) */
    const catRectNow = () => {
      const r = root.getBoundingClientRect();
      const c = layoutRef.current.cat;
      return { left: r.left + c.left, top: r.top + c.top, width: c.width, height: c.height };
    };
    const lookAt = (clientX: number, clientY: number) => {
      if (reduced() || mood === 'sleepy') return;
      const rect = catRectNow();
      const dx = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / (rect.width * 1.2)));
      const dy = Math.max(-1, Math.min(1, (clientY - (rect.top + rect.height * 0.25)) / rect.height));
      motion.lookAt(dx * 2.6 + dy * 0.8, dx * 1.2);
      motion.orbitTo(dx * 6, dy * -1.2);
      kick();
      window.clearTimeout(gazeTimer);
      gazeTimer = window.setTimeout(() => {
        motion.lookAt(0, 0);
        motion.orbitTo(0, 0);
        kick();
      }, 2600);
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
      else if (n === 10) react(skinRef.current === 'queen' ? 'heart' : 'excited');
      else if (n === 20) react('special');
      else if (n > 20 && n % 25 === 0) react(Math.random() < 0.5 ? 'heart' : 'excited');
    };
    const wakeUp = () => {
      if (mood === 'sleepy') {
        setMood('');
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
      const side = Math.max(-1, Math.min(1, ((e.clientX - catRect.left) / catRect.width - 0.5) * 2));
      const onHead = (e.clientY - catRect.top) / catRect.height < rigRef.current.headBottom;
      const now = performance.now();
      lastActivity = now;
      lookAt(e.clientX, e.clientY);
      wakeUp();
      if (onPressRef.current) {
        pressStarts.set(e.pointerId, now);
        motion.tap(0.6, side, onHead);
        kick();
        feel(now);
        return;
      }
      const h = handlerRef.current;
      if (!h.tap()) {
        // энергии нет: кот только устало кивает, награды нет
        motion.tap(0.35, side, false);
        kick();
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
      // серия усиливает только картинку: 1–3 обычно, 4–9 живее, 10+ заметнее; награда — как в логике игры
      const tier = streak >= 10 ? 3 : streak >= 4 ? 2 : 1;
      const strength = tier === 3 ? 1.35 : tier === 2 ? 1.18 : 1;
      motion.tap(reduced() ? 0 : strength, side, onHead);
      // в серии кот притопывает в такт — каждый второй тап
      if (tier >= 2 && streak % 2 === 0 && !reduced()) motion.stomp(tier === 3 ? 0.9 : 0.7);
      kick();
      spawnFloat(
        x,
        y - 10,
        `+${formatShort(h.reward(), localeRef.current)}`,
        tier === 3 ? 1.18 : tier === 2 ? 1.08 : 1,
      );
      spawnFlash(x, y, tier === 3 ? 1.5 : 1.15);
      spawnRing(x, y, tier === 3 ? 1.35 : 1);
      // Легендарная Корона: своя реакция — двойная волна
      if (skinRef.current === 'legendary_crown') spawnRing(x, y, 1.7);
      spawnParticles(x, y, tier + 1);
      if (tier === 3) spawnParticles(x, y, 1, 'gold', 1.4);
      if (onHead || tier >= 2) squint();
      ledFlash();
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

    // моргание раз в 3–7 секунд
    let blinkTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(
        () => {
          if (!document.hidden && performance.now() - lidAt > 1200) blink();
          scheduleBlink();
        },
        3000 + Math.random() * 4000,
      );
    };
    scheduleBlink();

    // спокойные действия в простое (не чаще раза в 6 с) и засыпание
    type Idle = 'glance' | 'blink' | 'wink' | 'swish' | 'nod' | 'look' | 'ear' | 'stomp';
    const IDLE: Idle[] = [
      'glance',
      'stomp',
      'blink',
      'swish',
      'ear',
      'glance',
      'wink',
      'stomp',
      'nod',
      'look',
    ];
    let idleTimer = 0;
    let lastIdle = -1;
    const idleAction = (a: Idle) => {
      switch (a) {
        case 'glance': {
          if (glancing) break;
          glancing = true;
          const dir = Math.random() < 0.5 ? -1 : 1;
          motion.lookAt(dir * 2.2, dir * 1.1);
          window.clearTimeout(gazeTimer);
          gazeTimer = window.setTimeout(() => {
            glancing = false;
            motion.lookAt(0, 0);
            kick();
          }, 1700);
          break;
        }
        case 'blink':
          blink();
          window.setTimeout(blink, 260);
          break;
        case 'wink':
          wink();
          break;
        case 'swish':
          motion.swish(55);
          break;
        case 'nod':
          motion.nod(-14);
          break;
        case 'look':
          motion.lookAt(0, 0);
          blink();
          break;
        case 'ear':
          motion.twitch(-1);
          later(() => motion.twitch(-1, 0.7), 220);
          break;
        case 'stomp':
          stomps(3);
          break;
      }
      kick();
    };
    // ухо иногда дёргается само по себе — как у настоящего кота
    let earTimer = 0;
    const scheduleEar = () => {
      earTimer = window.setTimeout(
        () => {
          if (!document.hidden && !reduced() && mood !== 'sleepy') {
            motion.twitch(Math.random() < 0.7 ? -1 : 1, 0.6 + Math.random() * 0.5);
            kick();
          }
          scheduleEar();
        },
        3_500 + Math.random() * 6_500,
      );
    };
    scheduleEar();
    // в покое кот медленно поворачивается то чуть в одну, то в другую сторону — живой объём
    let orbitTimer = 0;
    const scheduleOrbit = () => {
      orbitTimer = window.setTimeout(
        () => {
          if (!document.hidden && !reduced() && performance.now() - lastActivity > 2_600) {
            if (mood === 'sleepy') motion.orbitTo(0, -1.2);
            else motion.orbitTo((Math.random() * 2 - 1) * 4.5, Math.random() * 1.6 - 0.4);
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
      window.clearTimeout(earTimer);
      window.clearTimeout(orbitTimer);
      pending.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(blinkTimer);
      window.clearTimeout(moodTimer);
      window.clearTimeout(gazeTimer);
      if (raf) cancelAnimationFrame(raf);
      lidAnims.forEach((a) => a.cancel());
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

  const head = { x: L.cat.left + L.cat.width * rig.head.x, y: L.cat.top + L.cat.height * rig.head.y };
  return (
    <div
      ref={rootRef}
      className="hero-stage relative select-none"
      style={{ width, height, ...skinVars(skinId) }}
      data-testid="hero"
      data-skin={skinId}
    >
      <div className="absolute" style={{ left: L.cat.left, top: L.cat.top }}>
        <HeroFigure
          skinId={skinId}
          height={L.cat.height}
          refs={{ body: bodyRef, head: headRef, ear: earRef, tail: tailRef, foot: footRef, lids: lidsRef }}
        />
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
          style={{ left: L.cat.left + L.cat.width * 0.5, top: L.cat.top + L.cat.height * 0.5 }}
          data-testid="cat-hint"
          aria-hidden
        >
          <span className="hero-hint-ring" />
          <span className="hero-hint-hand">👆</span>
        </div>
      )}
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />
      {/* зона тапа — кот целиком с запасом по бокам, чтобы палец попадал и у самого края */}
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
