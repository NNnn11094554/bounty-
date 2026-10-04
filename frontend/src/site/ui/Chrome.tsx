import { useEffect, useRef, useState } from 'react';
import { MINI_APP_URL } from '../../lib/links';
import { LINKS, NAV, sectionIndex, type SectionId } from '../content';
import { useSite } from '../store';
import { flyTo, LAST_STATION, onTick } from '../timeline';
import { useActiveStation } from './hooks';
import { CommunityIcon, TelegramIcon, XIcon } from './icons';
import { k } from './reveal';

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

export function PlayButton({ className = '', label = 'Play now' }: { className?: string; label?: string }) {
  return (
    <a
      className={`btn btn-primary ${className}`}
      href={MINI_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

const SOCIALS = [
  { id: 'telegram', label: 'Telegram', href: LINKS.telegram, icon: <TelegramIcon /> },
  { id: 'x', label: 'X', href: LINKS.x, icon: <XIcon /> },
  { id: 'community', label: 'Community', href: LINKS.community, icon: <CommunityIcon /> },
] as const;

/**
 * Ссылки сообщества. Пока у ссылки нет адреса (X, сообщество — задаются при сборке), кнопка видна,
 * но неактивна и подписана «Soon» — никуда не ведёт.
 */
export function Socials({ wide = false, className = '' }: { wide?: boolean; className?: string }) {
  return (
    <div className={`socials ${className}`}>
      {SOCIALS.map((s) =>
        s.href ? (
          <a
            key={s.id}
            className={wide ? 'btn btn-ghost' : 'icon-btn'}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
          >
            {s.icon}
            {wide && <span>{socialText(s.id)}</span>}
          </a>
        ) : (
          <span
            key={s.id}
            className={wide ? 'btn btn-ghost is-soon' : 'icon-btn is-soon'}
            aria-label={`${s.label} — soon`}
            aria-disabled="true"
            title="Soon"
          >
            {s.icon}
            {wide && <span>{socialText(s.id)}</span>}
            {wide && <small>Soon</small>}
          </span>
        ),
      )}
    </div>
  );
}

const socialText = (id: string) =>
  id === 'telegram' ? 'Join Telegram' : id === 'x' ? 'Follow on X' : 'Community';

/** Пункт навигации, у которого камера сейчас (или ни одного — между пунктами). */
function useActiveNav(): number {
  const station = useActiveStation();
  return NAV.findIndex((n) => sectionIndex(n.id) === station);
}

export function Nav() {
  const active = useActiveNav();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const linksRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  // подложка активного пункта переезжает к нему; между пунктами — гаснет
  useEffect(() => {
    const host = linksRef.current;
    const pill = pillRef.current;
    if (!host || !pill) return;
    const link = active >= 0 ? host.querySelectorAll<HTMLElement>('.nav-link')[active] : undefined;
    pill.style.opacity = link ? '1' : '0';
    if (!link) return;
    pill.style.transition = pill.style.width
      ? 'transform 500ms var(--ease-out), width 500ms var(--ease-out), opacity 300ms ease'
      : '';
    pill.style.width = `${link.offsetWidth}px`;
    pill.style.transform = `translateX(${link.offsetLeft}px)`;
  }, [active]);

  // навигация становится стеклянной, как только страница сдвинулась
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      root.style.overflow = '';
    };
  }, [open]);

  const go = (id: SectionId) => {
    setOpen(false);
    flyTo(sectionIndex(id));
  };

  return (
    <>
      <header className="nav intro-fade" data-scrolled={scrolled || open} style={k(0)}>
        <button type="button" className="logo" onClick={() => go('home')} aria-label="Meowgul — home">
          <PawMark />
          MEOWGUL
        </button>
        <nav aria-label="Sections" className="nav-center">
          <div className="nav-links" ref={linksRef}>
            <span className="nav-pill" ref={pillRef} />
            {NAV.map((n, i) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="nav-link"
                aria-current={i === active ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(n.id);
                }}
              >
                {n.label}
              </a>
            ))}
          </div>
        </nav>
        <div className="nav-right">
          <Socials className="nav-socials" />
          <PlayButton className="btn-sm nav-play" />
          <button
            type="button"
            className="menu-button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span>
              <i />
              <i />
            </span>
          </button>
        </div>
        <ProgressLine />
      </header>
      <div className="menu" data-open={open} aria-hidden={!open}>
        <nav aria-label="Menu" className="menu-list">
          {NAV.map((n, i) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="menu-item"
              style={k(i)}
              onClick={(e) => {
                e.preventDefault();
                go(n.id);
              }}
              tabIndex={open ? 0 : -1}
            >
              <small>{String(i + 1).padStart(2, '0')}</small>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="menu-foot">
          <PlayButton className="menu-play" />
          <Socials className="menu-socials" />
        </div>
      </div>
    </>
  );
}

/** Тонкая линия пути под навигацией: сколько мира уже пройдено. */
function ProgressLine() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        if (ref.current) ref.current.style.transform = `scaleX(${(v.pos / LAST_STATION).toFixed(4)})`;
      }),
    [],
  );
  return <div className="progress-line" ref={ref} aria-hidden />;
}
