import { useEffect, useRef } from 'react';
import { RARITY_COLOR } from '../../game/skins';
import { MINI_APP_URL } from '../../lib/links';
import { CATS, catIcon } from '../cats';
import { TIERS, sectionIndex } from '../content';
import { useT, type Dict } from '../i18n';

type CatId = keyof Dict['cats'];
import { useSite } from '../store';
import { useAtStation } from './hooks';
import { ArrowIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';
import { Title } from './Title';

const count = String(CATS.length).padStart(2, '0');

/**
 * Карточка персонажа чуть наклоняется за курсором и подсвечивается там, где он (только мышь: на телефоне
 * карточка не должна «плыть» под пальцем, там выбор — свайпом и лентой).
 */
function tilt(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--rx', `${(x * 5).toFixed(2)}deg`);
  el.style.setProperty('--ry', `${(-y * 5).toFixed(2)}deg`);
  el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
  el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
}

function untilt(e: React.PointerEvent<HTMLElement>) {
  for (const v of ['--rx', '--ry', '--mx', '--my']) e.currentTarget.style.removeProperty(v);
}

/**
 * 4. Персонажи и коллекция: кольцо котов в сцене, выбранный — впереди; под карточкой — ступени редкости.
 * Выбор — стрелками, лентой портретов, свайпом по сцене или клавишами ← →. Карточка персонажа собирается заново при каждой смене.
 */
export function CollectionSection() {
  const t = useT();
  const selected = useSite((s) => s.selected);
  const select = useSite((s) => s.select);
  const cat = CATS[selected]!;
  const text = t.cats[cat.id as CatId];
  const go = (step: number) => select((selected + step + CATS.length) % CATS.length);
  const thumbsRef = useRef<HTMLDivElement>(null);

  // выбранный портрет — в середину ленты (лента прокручивается сама, страница — нет)
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[selected] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({
      left: thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [selected]);

  return (
    <>
      <SwipeLayer onSwipe={go} />
      <Section
        id="collection"
        layout="right"
        pass
        head={
          <>
            <Label>{t.collection.label}</Label>
            <Words text={t.collection.title} />
            <p className="lead" data-rv="up" style={k(2)}>
              {t.collection.lead}
            </p>
          </>
        }
      >
        <div data-rv="up" style={k(3)}>
          <div
            className="cat-card glass pe"
            style={{ ['--c' as string]: cat.accent, ['--r' as string]: RARITY_COLOR[cat.rarity] }}
            onPointerMove={tilt}
            onPointerLeave={untilt}
          >
            {/* key — карточка собирается заново для каждого кота */}
            <div key={cat.id} className="cat-card-body">
              <span className="tag swap-in" style={k(0)}>
                {String(selected + 1).padStart(2, '0')} / {count} · {text.world}
              </span>
              <Title className="cat-name" text={text.name} letters />
              <p className="cat-subtitle swap-in" style={{ ...k(1), color: cat.accent2 }}>
                {text.subtitle}
              </p>
              <p className="small cat-story swap-in" style={k(2)}>
                {text.story}
              </p>
              <dl className="cat-stats swap-in" style={k(3)}>
                <div>
                  <dt>{t.collection.rarity}</dt>
                  <dd className="rarity">{t.rarity[cat.rarity]}</dd>
                </div>
                <div>
                  <dt>{t.collection.type}</dt>
                  <dd>{text.type}</dd>
                </div>
                <div>
                  <dt>{t.collection.power}</dt>
                  <dd>
                    <span className="tabular">{cat.power}</span>
                    <span className="cat-power" aria-hidden>
                      <i style={{ transform: `scaleX(${cat.power / 100})`, background: cat.accent }} />
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="cat-picker">
              <button type="button" className="arrow" aria-label={t.collection.prev} onClick={() => go(-1)}>
                <ArrowIcon dir={-1} />
              </button>
              <div className="thumbs" ref={thumbsRef} role="tablist" aria-label={t.collection.list}>
                {CATS.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    className="thumb"
                    aria-selected={i === selected}
                    aria-current={i === selected}
                    aria-label={t.cats[c.id as CatId].name}
                    style={{ ['--c' as string]: c.accent }}
                    onClick={() => select(i)}
                  >
                    <img
                      src={catIcon(c.id)}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
              <button type="button" className="arrow" aria-label={t.collection.next} onClick={() => go(1)}>
                <ArrowIcon />
              </button>
            </div>
          </div>
        </div>
        <div className="tiers-block" data-rv="up" style={k(4)}>
          <p className="tag">{t.collection.tiers}</p>
          <ul className="tiers">
            {TIERS.map((rarity) => (
              <li
                key={rarity}
                className="tier"
                data-rarity={rarity}
                style={{ ['--r' as string]: RARITY_COLOR[rarity] }}
                title={t.collection.tierText[rarity]}
              >
                <span className="tier-gem" aria-hidden />
                <span className="tier-name">{t.rarity[rarity]}</span>
              </li>
            ))}
          </ul>
          <p className="small">
            {t.collection.note}{' '}
            <a className="inline-link" href={MINI_APP_URL} target="_blank" rel="noopener noreferrer">
              {t.collection.explore}
            </a>
          </p>
        </div>
      </Section>
    </>
  );
}

/** Свайп по сцене у персонажей (по горизонтали), вертикальный жест — прокрутка страницы. */
function SwipeLayer({ onSwipe }: { onSwipe: (step: number) => void }) {
  const active = useAtStation(sectionIndex('collection'));
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
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}
