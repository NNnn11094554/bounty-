import { formatShort, type Locale } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { DURATION, EASING, isReducedMotion } from '../animations';
import { onFrame } from '../game/frameLoop';
import { playSound } from '../lib/sound';
import { haptic } from '../telegram/webapp';
import { CharacterImage } from './CharacterImage';

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
  /** режим ввода шифра: тапы не тратят энергию, передаются наружу как нажатия */
  onPress?: (durationMs: number) => void;
}

const FLOAT_POOL = 28;
const RING_POOL = 10;
const COIN_POOL = 12;
const DANCE_TAPS_PER_SEC = 8;

/** Большая круглая кнопка с котом: мультитач, 3D-наклон, всплывающие «+N», танец, усталость. */
export function CatButton({ size, ringColor, handler, locale, sleepyLabel, onPress }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const danceRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  // пулы переиспользуемых элементов — никаких тысяч DOM-нод при яростном тапании
  useEffect(() => {
    const fx = fxRef.current;
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const dance = danceRef.current;
    if (!fx || !root || !tilt || !dance) return;
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
    let fi = 0;
    let ri = 0;
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
    const spawnRing = (x: number, y: number) => {
      const el = rings[ri++ % RING_POOL]!;
      el.animate(
        [
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(0.3)`, opacity: 0.7 },
          { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1.6)`, opacity: 0 },
        ],
        { duration: DURATION.tapRing, easing: 'ease-out' },
      );
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
    const tiltTo = (x: number, y: number, squeeze: number) => {
      if (isReducedMotion()) return;
      const r = size / 2;
      const ry = ((x - r) / r) * 10;
      const rx = -((y - r) / r) * 10;
      tilt.animate(
        [
          { transform: `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${squeeze})` },
          { transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)' },
        ],
        { duration: DURATION.tapTilt + 120, easing: EASING.springOut },
      );
    };
    const markDance = (now: number) => {
      recent.push(now);
      while (recent.length && now - recent[0]! > 1000) recent.shift();
      if (recent.length > DANCE_TAPS_PER_SEC && !isReducedMotion()) {
        dance.classList.add('cat-dance');
        window.clearTimeout(danceTimer);
        danceTimer = window.setTimeout(() => dance.classList.remove('cat-dance'), 450);
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
      e.preventDefault();
      const { x, y, inside } = insideCircle(e);
      if (!inside) return;
      if (onPressRef.current) {
        pressStarts.set(e.pointerId, performance.now());
        tiltTo(x, y, 0.97);
        haptic.impact('light');
        return;
      }
      const h = handlerRef.current;
      const ok = h.tap();
      if (!ok) {
        tiltTo(x, y, 0.98);
        haptic.notify('warning');
        return;
      }
      tiltTo(x, y, 0.95);
      spawnFloat(x, y, `+${formatShort(h.reward(), localeRef.current)}`);
      spawnRing(x, y);
      haptic.impact('light');
      playSound('tap');
      markDance(performance.now());
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
    const noMenu = (e: Event) => e.preventDefault();

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('contextmenu', noMenu);

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
      window.clearTimeout(danceTimer);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', cancel);
      root.removeEventListener('contextmenu', noMenu);
      [...floats, ...rings, ...coins].forEach((el) => el.remove());
    };
  }, [size]);

  const rainbow = ringColor === 'rainbow';
  return (
    <div
      ref={rootRef}
      className="cat-button relative select-none"
      style={{
        width: size,
        height: size,
        touchAction: 'none',
        ['--ring' as string]: rainbow ? '#ffc93c' : ringColor,
      }}
      role="button"
      aria-label="Tap the cat"
      data-testid="cat-button"
    >
      <div className="cat-glow pointer-events-none absolute inset-[-14%] rounded-full" />
      <div ref={danceRef} className="absolute inset-0">
        <div ref={tiltRef} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
          <div className={`cat-ring absolute inset-0 rounded-full ${rainbow ? 'cat-ring-rainbow' : ''}`} />
          <div className="breathe absolute inset-[6px] overflow-hidden rounded-full bg-night-900">
            <CharacterImage size={size} className="cat-img h-full w-full" />
          </div>
        </div>
      </div>
      <div className="cat-zzz pointer-events-none absolute -top-2 right-[8%] text-3xl font-black text-white/80">
        Zzz
      </div>
      <div className="cat-tired pointer-events-none absolute inset-x-0 bottom-[12%] text-center text-sm font-extrabold text-white/90">
        <span className="rounded-full bg-black/55 px-3 py-1">{sleepyLabel}</span>
      </div>
      <div ref={fxRef} className="pointer-events-none absolute inset-0 overflow-visible" />
    </div>
  );
}
