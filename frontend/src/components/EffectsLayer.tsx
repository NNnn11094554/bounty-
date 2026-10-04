import { useEffect, useRef } from 'react';
import { EASING, isReducedMotion } from '../animations';
import { onEffect, type Point } from '../game/effects';
import { playSound } from '../lib/sound';
import { haptic } from '../telegram/webapp';

const COLORS = ['#ffc93c', '#ff8a3d', '#ff5f6d', '#2ed3c6', '#a66bff', '#4ade80', '#ffffff'];
const COIN_POOL = 20;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
  coin: boolean;
}

/** Слой эффектов поверх всего: canvas-конфетти и пул монет для полёта в баланс. */
export function EffectsLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coinsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const coinLayer = coinsRef.current;
    if (!canvas || !coinLayer) return;
    const ctx = canvas.getContext('2d');
    let particles: Particle[] = [];
    let raf = 0;
    let last = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!ctx) {
        // без 2D-контекста рисовать нечем: цикл не держим, иначе следующие конфетти не запустятся
        particles = [];
        raf = 0;
        canvas.style.visibility = 'hidden';
        return;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of particles) {
        p.vy += 900 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.coin) {
          ctx.scale(Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2, 1);
          ctx.fillStyle = '#ffc93c';
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#e8a317';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = particles.length ? requestAnimationFrame(step) : 0;
      // холст на весь экран видеокарта складывает с остальными на каждом кадре — без конфетти он скрыт
      if (!raf) canvas.style.visibility = 'hidden';
    };

    const burst = (origin: Point | undefined, amount: number) => {
      const o = origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.42 };
      for (let i = 0; i < amount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
        const speed = 380 + Math.random() * 520;
        particles.push({
          x: o.x,
          y: o.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 14,
          w: 7 + Math.random() * 6,
          h: 10 + Math.random() * 8,
          color: COLORS[i % COLORS.length]!,
          life: 1.4 + Math.random() * 0.8,
          coin: i % 5 === 0,
        });
      }
      if (!raf) {
        last = performance.now();
        canvas.style.visibility = 'visible';
        raf = requestAnimationFrame(step);
      }
    };

    const pool = Array.from({ length: COIN_POOL }, () => {
      const el = document.createElement('div');
      el.className = 'fly-coin';
      el.style.opacity = '0';
      coinLayer.appendChild(el);
      return el;
    });
    let pi = 0;

    const fly = (from: Point, count: number) => {
      // счётчик баланса на видимом экране: если поверх вкладки открыт экран (бусты, профиль),
      // берём только его счётчик, иначе — счётчик видимой вкладки (скрытые вкладки тоже в документе);
      // нет счётчика — монеты не летят
      const scope =
        document.querySelector('[data-subscreen]') ?? document.querySelector('[data-tab]') ?? document;
      const targets = scope.querySelectorAll('[data-coin-target]');
      const target = targets[targets.length - 1];
      if (!target) return;
      const r = target.getBoundingClientRect();
      const to = { x: r.left + Math.min(28, r.width / 2), y: r.top + r.height / 2 };
      for (let i = 0; i < count; i++) {
        const el = pool[pi++ % COIN_POOL]!;
        const delay = i * 45;
        const spreadX = (Math.random() - 0.5) * 120;
        const spreadY = -40 - Math.random() * 80;
        const anim = el.animate(
          [
            { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(0.5)`, opacity: 0 },
            {
              transform: `translate(${from.x + spreadX}px, ${from.y + spreadY}px) translate(-50%, -50%) scale(1.1)`,
              opacity: 1,
              offset: 0.35,
            },
            { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(0.6)`, opacity: 1 },
          ],
          { duration: 720, delay, easing: EASING.smoothOut, fill: 'none' },
        );
        anim.onfinish = () => {
          playSound('coin');
          haptic.impact('soft');
          target.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
            {
              duration: 180,
            },
          );
        };
      }
    };

    const off = onEffect((event) => {
      if (event.kind === 'confetti') burst(event.origin, isReducedMotion() ? 30 : (event.amount ?? 140));
      else if (isReducedMotion()) fly(event.from, 3);
      else fly(event.from, event.count ?? 14);
    });

    return () => {
      off();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      pool.forEach((el) => el.remove());
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none invisible fixed inset-0 z-[70] h-full w-full"
        aria-hidden
      />
      <div ref={coinsRef} className="pointer-events-none fixed inset-0 z-[71]" aria-hidden />
    </>
  );
}
