import { formatShort, type Locale } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../animations';
import { catMood, type CatEvent } from '../game/catMood';
import { centerOf, confetti } from '../game/effects';
import { onFrame } from '../game/frameLoop';
import { EFFECT_PARTICLE, skinVars, type ParticleKind } from '../game/skins';
import { playSound } from '../lib/sound';
import { haptic } from '../telegram/webapp';
import { CatVisual } from './cat/CatVisual';

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
  size: number;
  ringColor: string;
  handler: TapHandler;
  locale: Locale;
  sleepyLabel: string;
  /** надетый скин и эффект тапа */
  skinId: string;
  effectId: string;
  /** режим ввода шифра: тапы не тратят энергию, передаются наружу как нажатия */
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
 * Живой кот на главном экране. Слои: визуал (CatVisual, без событий) → слой тапа (прозрачный круг)
 * → эффекты. Кот дышит и парит, следит взглядом за пальцем (2.5D-наклон), подпрыгивает от тапа,
 * радуется сериям тапов, засыпает в простое и показывает эмоции облачком рядом с головой.
 * Анимации — transform/opacity (WAAPI и CSS), без перерисовок React.
 */
export function CatButton({
  size,
  ringColor,
  handler,
  locale,
  sleepyLabel,
  skinId,
  effectId,
  onPress,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gazeRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const danceRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const accRef = useRef<SVGSVGElement>(null);
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

  useEffect(() => {
    const fx = fxRef.current;
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const dance = danceRef.current;
    const gaze = gazeRef.current;
    const bubble = bubbleRef.current;
    if (!fx || !root || !tilt || !dance || !gaze || !bubble) return;
    const reduced = () => isReducedMotion();

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
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.3)`, opacity: 0.7 },
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1.6)`, opacity: 0 },
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
    const coinSalute = () => {
      const c = size / 2;
      coins.forEach((el, i) => {
        const angle = (i / COIN_POOL) * Math.PI * 2 + Math.random() * 0.4;
        const dist = c * (0.9 + Math.random() * 0.5);
        el.animate(
          [
            {
              transform: `translate(${c}px, ${c}px) translate(-50%, -50%) scale(0.4) rotate(0deg)`,
              opacity: 1,
            },
            {
              transform: `translate(${c + Math.cos(angle) * dist}px, ${c + Math.sin(angle) * dist}px) translate(-50%, -50%) scale(1) rotate(${
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

    /** тап: наклон к точке касания, сжатие и маленький прыжок */
    const tapBounce = (x: number, y: number, squeeze: number) => {
      if (reduced()) return;
      const r = size / 2;
      const ry = ((x - r) / r) * 10;
      const rx = -((y - r) / r) * 10;
      tilt.animate(
        [
          { transform: `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${squeeze})` },
          {
            transform: `perspective(700px) rotateX(${rx * 0.3}deg) rotateY(${ry * 0.3}deg) translateY(-3%) scale(1.02)`,
            offset: 0.45,
          },
          { transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)' },
        ],
        { duration: DURATION.tapTilt + 180, easing: EASING.springOut },
      );
    };
    /** «уши»: аксессуар над головой вздрагивает */
    let accBusy = false;
    const twitch = (strength = 1) => {
      const acc = accRef.current;
      if (!acc || accBusy || reduced()) return;
      accBusy = true;
      const a = 7 * strength;
      acc
        .animate(
          [
            { transform: 'rotate(0deg)' },
            { transform: `rotate(${-a}deg) translateY(-2px)` },
            { transform: `rotate(${a * 0.6}deg)` },
            { transform: 'rotate(0deg)' },
          ],
          { duration: 360, easing: 'ease-out' },
        )
        .finished.catch(() => undefined)
        .finally(() => (accBusy = false));
    };
    let auraBusy = 0;
    const auraFlash = () => {
      const aura = auraRef.current;
      const now = performance.now();
      if (!aura || reduced() || now - auraBusy < 140) return;
      auraBusy = now;
      aura.animate(
        [
          { opacity: 1, transform: 'scale(1.08)' },
          { opacity: 0.8, transform: 'scale(1)' },
        ],
        {
          duration: 280,
          easing: 'ease-out',
        },
      );
    };

    // ── эмоции: облачко рядом с головой и движение всего кота ──
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
    const body = (keyframes: Keyframe[], duration: number) => {
      if (reduced()) return;
      dance.animate(keyframes, { duration, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
    };
    const center = () => ({ x: size / 2, y: size / 2 });
    let mood: '' | 'sleepy' | 'excited' = '';
    let moodTimer = 0;
    const setMood = (next: typeof mood, ms = 0) => {
      mood = next;
      root.dataset.mood = next;
      window.clearTimeout(moodTimer);
      if (ms) moodTimer = window.setTimeout(() => setMood(''), ms);
    };

    const react = (reaction: Reaction) => {
      const c = center();
      showBubble(reaction, reaction !== 'happy');
      switch (reaction) {
        case 'happy':
        case 'smile':
          body(
            [
              { transform: 'translateY(0)' },
              { transform: 'translateY(-4%)' },
              { transform: 'translateY(0)' },
            ],
            420,
          );
          twitch(0.8);
          break;
        case 'excited':
          setMood('excited', 2600);
          body(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.06) translateY(-5%)' },
              { transform: 'scale(1)' },
            ],
            460,
          );
          auraFlash();
          spawnParticles(c.x, c.y * 0.6, 6, 'star', 2);
          twitch(1.2);
          break;
        case 'special':
        case 'heart':
          setMood('excited', 3000);
          // 2.5D-разворот: кот делает оборот вокруг вертикальной оси
          if (!reduced()) {
            tilt.animate(
              [
                { transform: 'perspective(700px) rotateY(0deg)' },
                { transform: 'perspective(700px) rotateY(360deg)' },
              ],
              { duration: 720, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
            );
          }
          spawnParticles(c.x, c.y * 0.7, 10, 'heart', 2);
          auraFlash();
          haptic.notify('success');
          break;
        case 'celebrate':
          setMood('excited', 3500);
          body(
            [
              { transform: 'scale(1)' },
              { transform: 'scale(1.1) translateY(-7%)' },
              { transform: 'scale(1)' },
            ],
            600,
          );
          confetti(centerOf(root), 70);
          spawnParticles(c.x, c.y * 0.6, 10, 'gold', 2);
          break;
        case 'surprised':
          body([{ transform: 'scale(1)' }, { transform: 'scale(1.09)' }, { transform: 'scale(1)' }], 380);
          twitch(1.4);
          break;
        case 'annoyed':
          body(
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
        case 'wave':
          twitch(1.3);
          body(
            [
              { transform: 'rotate(0deg)' },
              { transform: 'rotate(-4deg)' },
              { transform: 'rotate(3deg)' },
              { transform: 'rotate(0deg)' },
            ],
            700,
          );
          break;
        case 'look':
          lookAtUser();
          break;
        case 'sleepy':
          setMood('sleepy');
          break;
      }
    };

    // ── взгляд: кот слегка поворачивается к пальцу/курсору (плавно, lerp) ──
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
      gaze.style.transform = `perspective(900px) rotateY(${(gx * 8).toFixed(2)}deg) rotateX(${(
        -gy * 6
      ).toFixed(2)}deg) translate3d(${(gx * 4).toFixed(1)}px, ${(gy * 3).toFixed(1)}px, 0)`;
      if (Math.abs(tx - gx) > 0.003 || Math.abs(ty - gy) > 0.003 || now - lastInput < 2700) {
        raf = requestAnimationFrame(step);
      }
    };
    const lookAt = (clientX: number, clientY: number) => {
      if (reduced()) return;
      const rect = root.getBoundingClientRect();
      tx = clamp((clientX - (rect.left + rect.width / 2)) / (rect.width * 0.9));
      ty = clamp((clientY - (rect.top + rect.height / 2)) / (rect.height * 0.9));
      lastInput = performance.now();
      if (!raf) raf = requestAnimationFrame(step);
    };
    const lookAtUser = () => {
      tx = 0;
      ty = 0;
      lastInput = -Infinity;
      if (!raf && !reduced()) raf = requestAnimationFrame(step);
      if (!reduced()) {
        tilt.animate(
          [
            { transform: 'perspective(700px) rotateX(0deg)' },
            { transform: 'perspective(700px) rotateX(7deg)' },
            { transform: 'perspective(700px) rotateX(0deg)' },
          ],
          { duration: 520, easing: 'ease-in-out' },
        );
      }
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
      if (recent.length > DANCE_TAPS_PER_SEC && !reduced()) {
        dance.classList.add('cat-dance');
        window.clearTimeout(danceTimer);
        danceTimer = window.setTimeout(() => dance.classList.remove('cat-dance'), 450);
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

    const insideCircle = (e: PointerEvent) => {
      const rect = tilt.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const r = rect.width / 2;
      return {
        x: (x * size) / rect.width,
        y: (y * size) / rect.height,
        inside: (x - r) ** 2 + (y - r) ** 2 <= r * r * 1.02,
      };
    };

    const onDown = (e: PointerEvent) => {
      // тап по коту — только игровое действие: без выделения, меню, жестов и обработчиков родителей
      e.preventDefault();
      e.stopPropagation();
      const { x, y, inside } = insideCircle(e);
      if (!inside) return;
      const now = performance.now();
      lastActivity = now;
      lookAt(e.clientX, e.clientY);
      wakeUp();
      if (onPressRef.current) {
        pressStarts.set(e.pointerId, now);
        tapBounce(x, y, 0.97);
        haptic.impact('light');
        return;
      }
      const h = handlerRef.current;
      const ok = h.tap();
      if (!ok) {
        tapBounce(x, y, 0.98);
        haptic.notify('warning');
        if (now - lastAnnoyed > 2500) {
          lastAnnoyed = now;
          react('annoyed');
        }
        return;
      }
      tapBounce(x, y, 0.95);
      spawnFloat(x, y, `+${formatShort(h.reward(), localeRef.current)}`);
      spawnRing(x, y);
      // Легендарная Корона: свои реакции — двойная неоновая волна
      if (skinRef.current === 'legendary_crown') spawnRing(x, y, 90);
      spawnParticles(x, y, 2);
      twitch(0.5);
      auraFlash();
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
      friend: 'heart',
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
  }, [size]);

  return (
    <div
      ref={rootRef}
      className="cat-button relative select-none"
      style={{ width: size, height: size, ...skinVars(skinId, size, ringColor) }}
      role="button"
      aria-label="Tap the cat"
      data-testid="cat-button"
      data-skin={skinId}
    >
      {/* визуальный слой: никаких событий, вход принимает только слой тапа ниже по коду */}
      <CatVisual
        size={size}
        skinId={skinId}
        leagueColor={ringColor}
        refs={{ gaze: gazeRef, dance: danceRef, tilt: tiltRef, accessory: accRef, aura: auraRef }}
      />
      <div className="cat-zzz pointer-events-none absolute -top-2 left-[6%] text-3xl font-black text-white/80">
        Zzz
      </div>
      <div className="cat-tired pointer-events-none absolute inset-x-0 -bottom-4 text-center text-sm font-extrabold text-white/90">
        <span className="rounded-full bg-black/55 px-3 py-1">{sleepyLabel}</span>
      </div>
      <div
        ref={bubbleRef}
        className="cat-bubble pointer-events-none"
        style={{ fontSize: Math.max(13, Math.round(size * 0.058)) }}
        data-testid="cat-bubble"
        aria-hidden
      />
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />
      {/* слой тапа — прозрачный круг поверх визуала */}
      <div className="cat-hit absolute inset-0 rounded-full" data-testid="cat-hit" />
    </div>
  );
}
