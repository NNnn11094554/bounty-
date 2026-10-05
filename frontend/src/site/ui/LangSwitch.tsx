import { useEffect, useId, useRef, useState } from 'react';
import { LOCALES, switchLocale, useLang, useT } from '../i18n';

/**
 * Переключатель языка в шапке: компактная кнопка (глобус и код языка) и список из всех языков на их же
 * языке. Закрывается по выбору, Escape и щелчку мимо; стрелки ↑ ↓ ходят по списку.
 */
export function LangSwitch() {
  const t = useT();
  const locale = useLang((s) => s.locale);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.lang-btn')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    // фокус — на текущий язык
    listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.lang-item') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="lang" ref={rootRef}>
      <button
        type="button"
        className="lang-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${t.nav.language}: ${LOCALES.find((l) => l.code === locale)!.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
        </svg>
        <span>{locale.toUpperCase()}</span>
      </button>
      <div
        className="lang-menu"
        id={id}
        role="menu"
        aria-label={t.nav.language}
        data-open={open}
        ref={listRef}
        onKeyDown={onListKey}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="menuitemradio"
            aria-checked={l.code === locale}
            lang={l.html}
            className="lang-item"
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false);
              void switchLocale(l.code);
            }}
          >
            <span className="lang-code">{l.code.toUpperCase()}</span>
            <span className="lang-name">{l.name}</span>
            {l.code === locale && (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="lang-check">
                <path
                  d="M2.5 6.2 5 8.6l4.6-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
