import { formatShort, type Locale } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../../animations';
import { catMood, type CatEvent } from '../../game/catMood';
import { centerOf, confetti } from '../../game/effects';
import { onFrame } from '../../game/frameLoop';
import { EFFECT_PARTICLE, HERO, heroAsset, skinVars, type ParticleKind } from '../../game/skins';
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
  /** место под сцену: кот и кнопка TAP вписываются в него */
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

const FLOAT_POOL = 28;
const RING_POOL = 10;
const COIN_POOL = 12;
const PT_POOL = 28;
const DANCE_TAPS_PER_SEC = 8;
/** серия тапов прерывается паузой дольше */
const STREAK_GAP_MS = 700;
/** без тапов столько — кот засыпает */
const SLEEP_AFTER_MS = 45_000;
/** случайные действия в простое — раз в 5–15 секунд, если не тапали хотя бы 4 секунды */
const IDLE_MIN_MS = 5_000;
const IDLE_SPREAD_MS = 10_000;
const IDLE_QUIET_MS = 4_000;

type Reaction =
  | 'happy'
  | 'excited'
  | 'special'
  | 'sleepy'
  | 'surprised'
  | 'annoyed'
  | 'wink'
  | 'smile'
  | 'heart'
  | 'celebrate'
  | 'wave'
  | 'look';

const EMOJI: Record<Reaction, string> = {
  happy: '😸',
  excited: '🤩',
  special: '😻',
  sleepy: '💤',
  surprised: '🙀',
  annoyed: '😾',
  wink: '😼',
  smile: '😺',
  heart: '😻',
  celebrate: '🥳',
  wave: '👋',
  look: '👀',
};
const TEXT: Partial<Record<Reaction, Record<Locale, string>>> = {
  special: { ru: 'Мур!', en: 'Purr!' },
  celebrate: { ru: 'Новый уровень!', en: 'Level up!' },
  excited: { ru: 'Ещё!', en: 'More!' },
};

/**
 * Главный экран: живой кот и кнопка TAP. Слои: визуал (без событий) → зоны нажатия (круг кнопки и
 * силуэт кота) → эффекты. Кот дышит, качает хвостом, моргает, тянется к пальцу, подпрыгивает от тапа,
 * радуется сериям, засыпает в простое и показывает эмоции облачком у головы. Кнопка вжимается и
 * вспыхивает. Анимации — transform/opacity (WAAPI и CSS), без перерисовок React.
 */
export function HeroStage({ width, height, handler, locale, sleepyLabel, skinId, effectId, onPress }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const leanRef = useRef<HTMLDivElement>(null);
  const bounceRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const lidsRef = useRef<SVGSVGElement>(null);
  const tapRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
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
  const L = heroLayout(width, height);
  // раскладка — через ref: при смене размера (свернулась лига, Telegram развернул окно) обработчики,
  // пулы и начатое нажатие остаются
  const layoutRef = useRef(L);
  layoutRef.current = L;

  useEffect(() => {
    const fx = fxRef.current;
    const root = rootRef.current;
    const lean = leanRef.current;
    const bounce = bounceRef.current;
    const tail = tailRef.current;
    const tapEl = tapRef.current;
    const bubble = bubbleRef.current;
    if (!fx || !root || !lean || !bounce || !tail || !tapEl || !bubble) return;
    const reduced = () => isReducedMotion();
    const idle = bounce.parentElement;

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
    const coins = make('tap-coin', COIN_POOL);
    const pts = make('tap-pt pt', PT_POOL);
    let fi = 0;
    let ri = 0;
    let pi = 0;
    let taps = 0;
    const recent: number[] = [];
    let danceTimer = 0;
    const pressStarts = new Map<number, number>();

    const spawnFloat = (x: number, y: number, text: string) => {
      const el = floats[fi++ % FLOAT_POOL]!;
      el.textContent = text;
      const drift = (Math.random() - 0.5) * 60;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.7)`, opacity: 1 },
          {
            transform: `translate(${x + drift * 0.6}px, ${y - 70}px) translate(-50%, -50%) scale(1.15)`,
            opacity: 1,
            offset: 0.35,
          },
          { transform: `translate(${x + drift}px, ${y - 150}px) translate(-50%, -50%) scale(1)`, opacity: 0 },
        ],
        { duration: DURATION.tapFloat, easing: EASING.smoothOut },
      );
    };
    const spawnRing = (x: number, y: number, delay = 0) => {
      const el = rings[ri++ % RING_POOL]!;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.3)`, opacity: 0.8 },
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1.7)`, opacity: 0 },
        ],
        { duration: DURATION.tapRing, easing: 'ease-out', delay },
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
        const dist = 60 + Math.random() * 60;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const rot = (Math.random() - 0.5) * 240;
        el.animate(
          [
            {
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.6) rotate(0deg)`,
              opacity: 1,
            },
            {
              transform: `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%) scale(1.1) rotate(${rot}deg)`,
              opacity: 0,
            },
          ],
          { duration: 650 + Math.random() * 250, easing: EASING.smoothOut },
        );
      }
    };
    const tapCenter = () => {
      const t = layoutRef.current.tap;
      return { x: t.left + t.width * HERO.paw.x, y: t.top + t.height * HERO.paw.y };
    };
    const headPoint = () => {
      const c = layoutRef.current.cat;
      return { x: c.left + c.width * HERO.head.x, y: c.top + c.height * HERO.head.y };
    };
    const coinSalute = () => {
      const c = tapCenter();
      const r = layoutRef.current.tap.width / 2;
      coins.forEach((el, i) => {
        const angle = (i / COIN_POOL) * Math.PI * 2 + Math.random() * 0.4;
        const dist = r * (1.1 + Math.random() * 0.6);
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

    // ── движения кота ──
    const hop = (strength: number) => {
      if (reduced()) return;
      const s = strength;
      bounce.animate(
        [
          { transform: `scale(${1 + 0.02 * s}, ${1 - 0.045 * s})` },
          { transform: `translateY(${-3.2 * s}%) scale(${1 - 0.012 * s}, ${1 + 0.03 * s})`, offset: 0.42 },
          { transform: 'translateY(0) scale(1, 1)' },
        ],
        { duration: 300 + 120 * s, easing: EASING.springOut },
      );
    };
    let tailBusy = false;
    const flick = (strength = 1) => {
      if (tailBusy || reduced()) return;
      tailBusy = true;
      const a = 7 * strength;
      tail
        .animate(
          [
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${a}deg)` },
            { transform: `rotate(${-a * 0.5}deg)` },
            { transform: 'rotate(0deg)' },
          ],
          { duration: 460, easing: 'ease-out' },
        )
        .finished.catch(() => undefined)
        .finally(() => (tailBusy = false));
    };
    const pressButton = (strength: number) => {
      if (reduced()) return;
      tapEl.animate(
        [
          { transform: `scale(${1 - 0.1 * strength})` },
          { transform: `scale(${1 + 0.04 * strength})`, offset: 0.55 },
          { transform: 'scale(1)' },
        ],
        { duration: 300, easing: EASING.springOut },
      );
    };
    let ledBusy = 0;
    const ledFlash = () => {
      const now = performance.now();
      if (reduced() || now - ledBusy < 120) return;
      ledBusy = now;
      root
        .querySelectorAll<HTMLElement>('.hero-led, .tap-halo')
        .forEach((el) =>
          el.animate([{ opacity: 1 }, { opacity: 0.55 }], { duration: 260, easing: 'ease-out' }),
        );
    };
    const lids = () => Array.from(lidsRef.current?.querySelectorAll<SVGElement>('.hero-lid') ?? []);
    const lashes = () => Array.from(lidsRef.current?.querySelectorAll<SVGElement>('.hero-lash') ?? []);
    /** моргание: веки закрываются за 70 мс, держатся hold мс и открываются за 90 мс */
    const blink = (eyes: number[] = [0, 1], hold = 0) => {
      if (reduced() || mood === 'sleepy') return;
      const duration = 160 + hold;
      const shut = 70 / duration;
      const open = (70 + hold) / duration;
      const pick = (els: SVGElement[]) => els.filter((el) => eyes.includes(Number(el.dataset.eye)));
      for (const el of pick(lids())) {
        el.animate(
          [
            { transform: 'scaleY(0)' },
            { transform: 'scaleY(1)', offset: shut },
            { transform: 'scaleY(1)', offset: open },
            { transform: 'scaleY(0)' },
          ],
          { duration, easing: 'ease-in-out' },
        );
      }
      for (const el of pick(lashes())) {
        el.animate(
          [{ opacity: 0 }, { opacity: 1, offset: shut }, { opacity: 1, offset: open }, { opacity: 0 }],
          {
            duration,
          },
        );
      }
    };

    // ── эмоции: облачко у головы и движение кота ──
    let bubbleUntil = 0;
    const showBubble = (reaction: Reaction, force = false) => {
      const now = performance.now();
      if (!force && now < bubbleUntil - 900) return;
      bubbleUntil = now + 1700;
      const text = TEXT[reaction]?.[localeRef.current];
      bubble.innerHTML = '';
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = EMOJI[reaction];
      bubble.appendChild(emoji);
      if (text) bubble.appendChild(document.createTextNode(text));
      bubble.dataset.reaction = reaction;
      bubble.animate(
        [
          { opacity: 0, transform: 'scale(0.4) translateY(6px)' },
          { opacity: 1, transform: 'scale(1.08) translateY(0)', offset: 0.18 },
          { opacity: 1, transform: 'scale(1)', offset: 0.3 },
          { opacity: 1, transform: 'scale(1)', offset: 0.8 },
          { opacity: 0, transform: 'scale(0.9) translateY(-8px)' },
        ],
        { duration: 1700, easing: 'ease-out' },
      );
    };
    const move = (keyframes: Keyframe[], duration: number) => {
      if (reduced()) return;
      bounce.animate(keyframes, { duration, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    };
    let mood: '' | 'sleepy' | 'excited' = '';
    let moodTimer = 0;
    const setMood = (next: typeof mood, ms = 0) => {
      mood = next;
      root.dataset.mood = next;
      window.clearTimeout(moodTimer);
      if (ms) moodTimer = window.setTimeout(() => setMood(''), ms);
    };

    const react = (reaction: Reaction) => {
      const head = headPoint();
      showBubble(reaction, reaction !== 'happy');
      switch (reaction) {
        case 'happy':
        case 'smile':
          hop(1);
          flick(0.8);
          break;
        case 'excited':
          setMood('excited', 2600);
          hop(1.6);
          flick(1.3);
          ledFlash();
          spawnParticles(head.x, head.y, 6, 'star', 2);
          break;
        case 'special':
        case 'heart':
          setMood('excited', 3000);
          // 2.5D-разворот: кот делает оборот вокруг вертикальной оси
          move(
            [
              { transform: 'perspective(900px) rotateY(0deg)' },
              { transform: 'perspective(900px) rotateY(360deg)' },
            ],
            760,
          );
          spawnParticles(head.x, head.y, 10, 'heart', 2);
          ledFlash();
          haptic.notify('success');
          break;
        case 'celebrate':
          setMood('excited', 3500);
          hop(2.2);
          flick(1.5);
          confetti(centerOf(root), 70);
          spawnParticles(head.x, head.y, 10, 'gold', 2);
          break;
        case 'surprised':
          move(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.04, 1.07) translateY(-2%)' },
              { transform: 'scale(1)' },
            ],
            380,
          );
          flick(1.4);
          break;
        case 'annoyed':
          move(
            [
              { transform: 'translateX(0)' },
              { transform: 'translateX(-3%)' },
              { transform: 'translateX(3%)' },
              { transform: 'translateX(-2%)' },
              { transform: 'translateX(0)' },
            ],
            420,
          );
          break;
        case 'wink':
          blink([0], 220);
          flick(0.7);
          break;
        case 'wave':
          move(
            [
              { transform: 'rotate(0deg)' },
              { transform: 'rotate(-2.5deg)' },
              { transform: 'rotate(2deg)' },
              { transform: 'rotate(0deg)' },
            ],
            700,
          );
          flick(1.2);
          break;
        case 'look':
          lookAtUser();
          blink();
          break;
        case 'sleepy':
          setMood('sleepy');
          break;
      }
    };

    // ── взгляд: кот слегка тянется к пальцу/курсору (плавно, lerp) ──
    let gx = 0;
    let gy = 0;
    let tx = 0;
    let ty = 0;
    let lastInput = -Infinity;
    let raf = 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const step = () => {
      raf = 0;
      const now = performance.now();
      if (now - lastInput > 2600) {
        tx = 0;
        ty = 0;
      }
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      lean.style.transform = `perspective(1100px) rotateY(${(gx * 9).toFixed(2)}deg) rotateX(${(
        -gy * 4
      ).toFixed(2)}deg) translate3d(${(gx * 3).toFixed(1)}px, 0, 0)`;
      if (Math.abs(tx - gx) > 0.003 || Math.abs(ty - gy) > 0.003 || now - lastInput < 2700) {
        raf = requestAnimationFrame(step);
      }
    };
    const lookAt = (clientX: number, clientY: number) => {
      if (reduced()) return;
      const rect = lean.getBoundingClientRect();
      tx = clamp((clientX - (rect.left + rect.width / 2)) / (rect.width * 1.4));
      ty = clamp((clientY - (rect.top + rect.height * 0.25)) / (rect.height * 0.8));
      lastInput = performance.now();
      if (!raf) raf = requestAnimationFrame(step);
    };
    const lookAtUser = () => {
      tx = 0;
      ty = 0;
      lastInput = -Infinity;
      if (!raf && !reduced()) raf = requestAnimationFrame(step);
      move(
        [
          { transform: 'perspective(900px) rotateX(0deg)' },
          { transform: 'perspective(900px) rotateX(5deg)' },
          { transform: 'perspective(900px) rotateX(0deg)' },
        ],
        520,
      );
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.buttons) lookAt(e.clientX, e.clientY);
    };

    // ── серии тапов и простой ──
    let lastTap = 0;
    let streak = 0;
    let lastActivity = performance.now();
    let lastAnnoyed = 0;
    const markDance = (now: number) => {
      recent.push(now);
      while (recent.length && now - recent[0]! > 1000) recent.shift();
      if (recent.length > DANCE_TAPS_PER_SEC && !reduced() && idle) {
        idle.classList.add('hero-dance');
        window.clearTimeout(danceTimer);
        danceTimer = window.setTimeout(() => idle.classList.remove('hero-dance'), 450);
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

    const onDown = (e: PointerEvent) => {
      const zone = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-hit]')?.dataset.hit;
      if (!zone) return;
      // тап — только игровое действие: без выделения, меню, жестов и обработчиков родителей
      e.preventDefault();
      e.stopPropagation();
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const onButton = zone === 'tap';
      const now = performance.now();
      lastActivity = now;
      lookAt(e.clientX, e.clientY);
      wakeUp();
      if (onPressRef.current) {
        pressStarts.set(e.pointerId, now);
        pressButton(onButton ? 0.7 : 0.3);
        hop(onButton ? 0.4 : 0.8);
        haptic.impact('light');
        return;
      }
      const h = handlerRef.current;
      const ok = h.tap();
      if (!ok) {
        pressButton(0.3);
        haptic.notify('warning');
        if (now - lastAnnoyed > 2500) {
          lastAnnoyed = now;
          react('annoyed');
        }
        return;
      }
      pressButton(onButton ? 1 : 0.35);
      hop(onButton ? 0.55 : 1);
      spawnFloat(x, y, `+${formatShort(h.reward(), localeRef.current)}`);
      spawnRing(x, y);
      // Легендарная Корона: свои реакции — двойная неоновая волна
      if (skinRef.current === 'legendary_crown') spawnRing(x, y, 90);
      spawnParticles(x, y, 2);
      flick(0.45);
      ledFlash();
      haptic.impact('light');
      playSound('tap');
      markDance(now);
      streak = now - lastTap < STREAK_GAP_MS ? streak + 1 : 1;
      lastTap = now;
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

    // моргание раз в 2,5–6 секунд
    let blinkTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(
        () => {
          if (!document.hidden) blink();
          scheduleBlink();
        },
        2500 + Math.random() * 3500,
      );
    };
    scheduleBlink();

    // случайные «живые» действия в простое и засыпание
    const IDLE_ACTIONS: Reaction[] = ['look', 'wink', 'wave', 'smile', 'look'];
    let idleTimer = 0;
    let lastIdle = -1;
    const scheduleIdle = () => {
      idleTimer = window.setTimeout(runIdle, IDLE_MIN_MS + Math.random() * IDLE_SPREAD_MS);
    };
    const runIdle = () => {
      const quiet = performance.now() - lastActivity;
      if (!document.hidden && !onPressRef.current) {
        if (quiet > SLEEP_AFTER_MS) {
          if (mood !== 'sleepy') react('sleepy');
          showBubble('sleepy', true);
        } else if (quiet > IDLE_QUIET_MS) {
          let i = Math.floor(Math.random() * IDLE_ACTIONS.length);
          if (i === lastIdle) i = (i + 1) % IDLE_ACTIONS.length;
          lastIdle = i;
          react(IDLE_ACTIONS[i]!);
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
      window.clearTimeout(danceTimer);
      window.clearTimeout(idleTimer);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(moodTimer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('contextmenu', noMenu);
      root.removeEventListener('click', noMenu);
      [...floats, ...rings, ...coins, ...pts].forEach((el) => el.remove());
    };
  }, []);

  const head = { x: L.cat.left + L.cat.width * HERO.head.x, y: L.cat.top + L.cat.height * HERO.head.y };
  const fontSize = Math.max(13, Math.round(L.cat.height * 0.045));
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
          refs={{ lean: leanRef, bounce: bounceRef, tail: tailRef, lids: lidsRef }}
        />
      </div>
      <div
        className="hero-tap absolute"
        style={{ left: L.tap.left, top: L.tap.top, width: L.tap.width, height: L.tap.height }}
      >
        <div className="tap-halo absolute" />
        <div ref={tapRef} className="tap-press absolute inset-0">
          <div
            className="hero-layer tap-img absolute inset-0"
            style={{ backgroundImage: `url(${heroAsset(skinId, 'tap')})` }}
          />
          <div
            className="tap-paw absolute"
            style={{ left: `${HERO.paw.x * 100}%`, top: `${HERO.paw.y * 100}%`, width: '44%' }}
          />
        </div>
      </div>
      <div
        className="hero-zzz pointer-events-none absolute text-3xl font-black text-white/80"
        style={{ left: head.x + L.cat.width * 0.12, top: Math.max(0, head.y - L.cat.height * 0.12) }}
      >
        Zzz
      </div>
      <div
        className="hero-tired pointer-events-none absolute text-center text-sm font-extrabold text-white/90"
        style={{ left: L.tap.left - 20, width: L.tap.width + 40, top: L.tap.top + L.tap.height + 2 }}
      >
        <span className="rounded-full bg-black/55 px-3 py-1">{sleepyLabel}</span>
      </div>
      <div
        ref={bubbleRef}
        className="cat-bubble pointer-events-none"
        style={{
          fontSize,
          left: head.x + L.cat.width * 0.16,
          top: Math.max(0, head.y - L.cat.height * 0.13),
        }}
        data-testid="cat-bubble"
        aria-hidden
      />
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />
      {/* зоны нажатия поверх визуала: круг кнопки TAP и силуэт кота */}
      <div
        className="hero-hit absolute rounded-full"
        style={{
          left: L.tap.left + L.tap.width * 0.06,
          top: L.tap.top + L.tap.height * 0.08,
          width: L.tap.width * 0.88,
          height: L.tap.width * 0.88,
        }}
        data-hit="tap"
        role="button"
        aria-label="Tap"
        data-testid="tap-button"
      />
      <div
        className="hero-hit absolute"
        style={{
          left: L.cat.left + L.cat.width * 0.16,
          top: L.cat.top,
          width: L.cat.width * 0.74,
          height: L.cat.height,
          borderRadius: '42% 42% 18% 18%',
        }}
        data-hit="cat"
        data-testid="cat-hit"
      />
    </div>
  );
}
