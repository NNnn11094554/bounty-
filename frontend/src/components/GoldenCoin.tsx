import { formatInt, type GoldenCoinEvent } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { endpoints } from '../api/endpoints';
import { runAction } from '../game/actions';
import { centerOf, flyCoins } from '../game/effects';
import { tapEngine } from '../game/tapEngine';
import { useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useEvents } from '../store/events';
import { toast } from '../store/toasts';
import { haptic } from '../telegram/webapp';
import { CoinIcon } from './icons';

const SIZE = 60;

function Runner({ coin, width, height }: { coin: GoldenCoinEvent; width: number; height: number }) {
  const t = useT();
  const clear = useEvents((s) => s.clearGoldenCoin);
  const ref = useRef<HTMLButtonElement>(null);
  const [caught, setCaught] = useState<{ x: number; y: number } | null>(null);
  const busy = useRef(false);

  // время сервера → локальное: монета бежит ровно в своё окно
  // (считается один раз при появлении — иначе каждая перерисовка перезапускала бы анимацию)
  const [{ delay, duration }] = useState(() => {
    const now = tapEngine.serverNow();
    return {
      delay: Math.max(0, coin.appearsAt - now),
      duration: Math.max(500, coin.expiresAt - Math.max(coin.appearsAt, now)),
    };
  });

  // траектория: от края до края волной (Web Animations — только transform и opacity, без перерисовки React)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seed = Number.parseInt(coin.id.replace(/-/g, '').slice(0, 6), 16) || 0;
    const fromLeft = seed % 2 === 0;
    // монета бежит над котом или под ним — по лицу персонажа ничего не пробегает
    const area = el.parentElement?.getBoundingClientRect();
    const cat = el.parentElement?.parentElement
      ?.querySelector('[data-testid="cat-button"]')
      ?.getBoundingClientRect();
    let band = { top: 0, bottom: height * 0.3 };
    if (area && cat) {
      const above = { top: 0, bottom: cat.top - area.top };
      const below = { top: cat.bottom - area.top, bottom: height };
      band = above.bottom - above.top >= below.bottom - below.top ? above : below;
    }
    const room = Math.max(0, band.bottom - band.top - SIZE);
    const baseY = band.top + room / 2;
    const amp = Math.min(22, room / 2);
    const [x0, x1] = fromLeft ? [-SIZE, width] : [width, -SIZE];
    const frames: Keyframe[] = Array.from({ length: 13 }, (_, i) => {
      const p = i / 12;
      const x = x0 + (x1 - x0) * p;
      const y = baseY + amp * Math.sin(p * Math.PI * 3);
      const rot = (fromLeft ? 1 : -1) * 720 * p;
      return {
        transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
        opacity: p === 0 ? 0 : p > 0.92 ? 0.85 : 1,
      };
    });
    const anim = el.animate(frames, { delay, duration, easing: 'linear', fill: 'both' });
    return () => anim.cancel();
  }, [coin.id, delay, duration, width, height]);

  useEffect(() => {
    const id = window.setTimeout(() => clear(coin.id), delay + duration + 400);
    return () => window.clearTimeout(id);
  }, [clear, coin.id, delay, duration]);

  const catchIt = async () => {
    if (busy.current || caught) return;
    busy.current = true;
    const point = centerOf(ref.current);
    const box = ref.current?.parentElement?.getBoundingClientRect();
    const local = { x: point.x - (box?.left ?? 0), y: point.y - (box?.top ?? 0) };
    haptic.impact('heavy');
    const res = await runAction({
      request: () => endpoints.claimGoldenCoin(coin.id),
      errorKey: (err) => (err.code === 'NOT_COMPLETED' ? 'event.coin.missed' : undefined),
    });
    busy.current = false;
    if (!res) {
      clear(coin.id);
      return;
    }
    setCaught(local);
    playSound('coin');
    haptic.notify('success');
    flyCoins(point, 16);
    toast.reward(t('event.coin.caught', { reward: formatInt(res.reward) }));
    window.setTimeout(() => clear(coin.id), 900);
  };

  return (
    <>
      {!caught && (
        <button
          ref={ref}
          type="button"
          aria-label={t('event.coin.label')}
          onPointerDown={(e) => {
            e.stopPropagation();
            void catchIt();
          }}
          className="absolute left-0 top-0 z-30 grid place-items-center rounded-full opacity-0"
          style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
          data-testid="golden-coin"
        >
          <span className="absolute inset-[-10px] rounded-full bg-gold/40 blur-xl" aria-hidden />
          <CoinIcon size={SIZE} className="relative drop-shadow-[0_4px_12px_rgba(255,201,60,0.7)]" />
        </button>
      )}
      <AnimatePresence>
        {caught && (
          <motion.span
            className="pointer-events-none absolute left-0 top-0 z-30 text-3xl font-black text-gold [text-shadow:0_2px_0_#7a4a00,0_0_16px_rgba(255,201,60,0.8)]"
            initial={{ opacity: 0, x: caught.x - 40, y: caught.y - 20, scale: 0.6 }}
            animate={{ opacity: 1, x: caught.x - 40, y: caught.y - 80, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            +{formatInt(coin.reward)}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Золотая монета пробегает по экрану Офиса за 3 секунды — поймай её касанием.
 * Появление и награду решает сервер; клиент только показывает и отправляет «поймал».
 */
export function GoldenCoin() {
  const coin = useEvents((s) => s.goldenCoin);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(
      ([e]) => e && setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="pointer-events-none absolute inset-0 z-30 [&>*]:pointer-events-auto">
      {coin && size.width > 0 && <Runner key={coin.id} coin={coin} width={size.width} height={size.height} />}
    </div>
  );
}
