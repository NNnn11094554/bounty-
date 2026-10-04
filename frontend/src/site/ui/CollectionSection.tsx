import { useEffect, useRef } from 'react';
import { RARITY_COLOR } from '../../game/skins';
import { CATS, RARITY_LABEL, catIcon } from '../cats';
import { useSite } from '../store';
import { useAtStation } from './hooks';
import { StationPanel } from './StationPanel';
import { Title } from './Title';

const k = (n: number) => ({ ['--k' as string]: n });
const count = String(CATS.length).padStart(2, '0');

/**
 * Коллекция: кольцо котов в сцене, выбранный — впереди. Выбор — стрелками, лентой портретов,
 * свайпом по сцене или клавишами ← →. Карточка персонажа проявляется заново при каждой смене.
 */
export function CollectionSection() {
  const selected = useSite((s) => s.selected);
  const select = useSite((s) => s.select);
  const cat = CATS[selected]!;
  const go = (step: number) => select((selected + step + CATS.length) % CATS.length);

  return (
    <>
      <SwipeLayer onSwipe={go} />
      <StationPanel index={2} label="Коллекция котов">
        <div className="dock dock-right station-inner" style={{ ['--c' as string]: cat.accent }}>
          <p className="kicker reveal" style={k(0)}>
            Коллекция · {count} персонажей
          </p>
          {/* key — карточка собирается заново для каждого кота */}
          <div key={cat.id} className="flex flex-col gap-2 sm:gap-3">
            <span
              className="mono swap-in text-[11px] tracking-[0.2em] text-[color:var(--ink-3)]"
              style={k(0)}
            >
              {String(selected + 1).padStart(2, '0')} / {count} · {cat.world.toUpperCase()}
            </span>
            <Title className="cat-name" text={cat.name} letters />
            <p className="cat-subtitle swap-in" style={{ ...k(1), color: cat.accent2 }}>
              {cat.subtitle}
            </p>
            <p className="lead swap-in wide-only" style={k(2)}>
              {cat.story}
            </p>
            <dl className="cat-stats swap-in" style={k(3)}>
              <div>
                <dt>Редкость</dt>
                <dd style={{ color: RARITY_COLOR[cat.rarity] }}>{RARITY_LABEL[cat.rarity]}</dd>
              </div>
              <div>
                <dt>Сила</dt>
                <dd>
                  <span className="num">{cat.power}</span>
                  <span className="cat-power" aria-hidden>
                    <i style={{ transform: `scaleX(${cat.power / 100})`, background: cat.accent }} />
                  </span>
                </dd>
              </div>
              <div>
                <dt>Стихия</dt>
                <dd>{cat.element}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-1 flex items-center gap-3 reveal" style={k(2)}>
            <button
              type="button"
              className="arrow wide-only"
              aria-label="Предыдущий кот"
              onClick={() => go(-1)}
            >
              <Arrow dir={-1} />
            </button>
            <div className="thumbs min-w-0 flex-1 overflow-x-auto py-1" role="tablist" aria-label="Коты">
              {CATS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  className="thumb"
                  aria-selected={i === selected}
                  aria-current={i === selected}
                  aria-label={c.name}
                  style={{ ['--c' as string]: c.accent }}
                  onClick={() => select(i)}
                >
                  <img
                    src={catIcon(c.id)}
                    alt=""
                    width={54}
                    height={54}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="arrow wide-only"
              aria-label="Следующий кот"
              onClick={() => go(1)}
            >
              <Arrow dir={1} />
            </button>
          </div>
        </div>
      </StationPanel>
    </>
  );
}

function Arrow({ dir }: { dir: 1 | -1 }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden
      style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}
    >
      <path
        d="M3 9h11M10 4.5 14.5 9 10 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Свайп по сцене у коллекции (по горизонтали), вертикальный жест — прокрутка страницы. */
function SwipeLayer({ onSwipe }: { onSwipe: (step: number) => void }) {
  const active = useAtStation(2);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const swipe = useRef(onSwipe);
  swipe.current = onSwipe;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') swipe.current(1);
      if (e.key === 'ArrowLeft') swipe.current(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div
      className="swipe-layer"
      style={{ display: active ? 'block' : 'none' }}
      aria-hidden
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const s = start.current;
        start.current = null;
        if (!s || s.id !== e.pointerId) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) onSwipe(dx < 0 ? 1 : -1);
        else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
          // тап по коту сбоку — выбрать его
          const third = window.innerWidth / 3;
          if (e.clientX < third * 0.8) onSwipe(-1);
          else if (e.clientX > window.innerWidth - third * 0.8) onSwipe(1);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
