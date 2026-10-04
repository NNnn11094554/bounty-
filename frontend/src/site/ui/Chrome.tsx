import { useEffect, useRef, useState } from 'react';
import { MINI_APP_URL } from '../../lib/links';
import { STATION_CODE, STATION_LABEL, STATIONS } from '../content';
import { useSite } from '../store';
import { flyTo, LAST_STATION, onTick } from '../timeline';
import { useActiveStation } from './hooks';

/** Лапа — знак Meowgul. */
export function PawMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="paw-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <g fill="url(#paw-g)">
        <ellipse cx="12" cy="15.6" rx="5.4" ry="4.5" />
        <ellipse cx="5.4" cy="10.2" rx="2.15" ry="2.7" transform="rotate(-18 5.4 10.2)" />
        <ellipse cx="9.3" cy="6.2" rx="2.15" ry="2.8" transform="rotate(-6 9.3 6.2)" />
        <ellipse cx="14.7" cy="6.2" rx="2.15" ry="2.8" transform="rotate(6 14.7 6.2)" />
        <ellipse cx="18.6" cy="10.2" rx="2.15" ry="2.7" transform="rotate(18 18.6 10.2)" />
      </g>
    </svg>
  );
}

export function Loader() {
  const progress = useSite((s) => s.progress);
  const ready = useSite((s) => s.ready);
  const c = 2 * Math.PI * 40;
  return (
    <div className="loader" data-done={ready} role="status" aria-live="polite">
      <div>
        <svg className="loader-ring" viewBox="0 0 88 88" aria-hidden>
          <circle cx="44" cy="44" r="40" stroke="rgba(255,255,255,0.1)" />
          <circle
            cx="44"
            cy="44"
            r="40"
            stroke="#ffc93c"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0.04, progress))}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.23,1,0.32,1)' }}
          />
        </svg>
        <p className="loader-label">MEOWGUL · {String(Math.round(progress * 100)).padStart(2, '0')}%</p>
      </div>
    </div>
  );
}

export function PlayButton({ className = '' }: { className?: string }) {
  return (
    <a
      className={`btn btn-primary ${className}`}
      href={MINI_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Играть в Telegram
    </a>
  );
}

export function Nav() {
  const active = useActiveStation();
  const [open, setOpen] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // подложка активного пункта переезжает к нему
  useEffect(() => {
    const host = linksRef.current;
    const pill = pillRef.current;
    const link = host?.querySelectorAll<HTMLElement>('.nav-link')[active];
    if (!host || !pill || !link) return;
    pill.style.transition = pill.style.width
      ? 'transform 500ms var(--ease-out), width 500ms var(--ease-out)'
      : '';
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (i: number) => {
    setOpen(false);
    flyTo(i);
  };

  return (
    <>
      <header className="nav intro-fade" style={{ ['--k' as string]: 0 }}>
        <button type="button" className="logo" onClick={() => go(0)} aria-label="Meowgul — в начало">
          <PawMark />
          MEOWGUL
        </button>
        <nav aria-label="Разделы">
          <div className="nav-links" ref={linksRef}>
            <span className="nav-pill" ref={pillRef} />
            {STATIONS.map((id, i) => (
              <button
                key={id}
                type="button"
                className="nav-link"
                aria-current={i === active}
                onClick={() => go(i)}
              >
                {STATION_LABEL[id]}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex items-center gap-3">
          <PlayButton className="hidden sm:inline-flex" />
          <button
            type="button"
            className="menu-button"
            aria-label="Меню"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span>
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>
      <div className="menu" data-open={open} aria-hidden={!open}>
        {STATIONS.map((id, i) => (
          <button
            key={id}
            type="button"
            className="menu-item"
            style={{ ['--k' as string]: i }}
            onClick={() => go(i)}
            tabIndex={open ? 0 : -1}
          >
            <small>{String(i + 1).padStart(2, '0')}</small>
            {STATION_LABEL[id]}
          </button>
        ))}
        <PlayButton className="menu-play mt-8 self-start" />
      </div>
    </>
  );
}

/** Шкала пути справа (десктоп) и тонкая линия прогресса сверху (телефон). */
export function Rail() {
  const active = useActiveStation();
  const fillRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        const k = (v.pos / LAST_STATION).toFixed(4);
        if (fillRef.current) fillRef.current.style.transform = `scaleY(${k})`;
        if (lineRef.current) lineRef.current.style.transform = `scaleX(${k})`;
      }),
    [],
  );
  return (
    <>
      <div className="rail intro-fade" style={{ ['--k' as string]: 3 }}>
        <span className="rail-label mono">
          {String(active + 1).padStart(2, '0')} / {String(STATIONS.length).padStart(2, '0')}
        </span>
        <div className="rail-track">
          <div className="rail-fill" ref={fillRef} />
          {STATIONS.map((id, i) => (
            <button
              key={id}
              type="button"
              className="rail-dot"
              style={{ top: `${(i / LAST_STATION) * 100}%` }}
              aria-current={i === active}
              aria-label={STATION_LABEL[id]}
              onClick={() => flyTo(i)}
            />
          ))}
        </div>
        <span className="rail-label">{STATION_CODE[STATIONS[active]!]}</span>
      </div>
      <div className="progress-line" ref={lineRef} />
    </>
  );
}
