import { useEffect, useRef } from 'react';
import { RARITY_COLOR } from '../../game/skins';
import { MINI_APP_URL } from '../../lib/links';
import { CATS, RARITY_LABEL, catIcon } from '../cats';
import { TIERS, sectionIndex } from '../content';
import { useSite } from '../store';
import { useAtStation } from './hooks';
import { ArrowIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';
import { Title } from './Title';

const count = String(CATS.length).padStart(2, '0');

/**
 * 4. Персонажи: кольцо котов в сцене, выбранный — впереди. Выбор — стрелками, лентой портретов,
 * свайпом по сцене или клавишами ← →. Карточка персонажа собирается заново при каждой смене.
 */
export function MeetCatsSection() {
  const selected = useSite((s) => s.selected);
  const select = useSite((s) => s.select);
  const cat = CATS[selected]!;
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
        id="cats"
        layout="right"
        pass
        head={
          <>
            <Label>Meet the cats</Label>
            <Words text="Every cat has a story" />
            <p className="lead" data-rv="up" style={k(2)}>
              From silent assassins to cosmic emperors, each character represents a different part of the
              world.
            </p>
          </>
        }
      >
        <div
          className="cat-card glass pe"
          data-rv="up"
          style={{ ...k(3), ['--c' as string]: cat.accent, ['--r' as string]: RARITY_COLOR[cat.rarity] }}
        >
          {/* key — карточка собирается заново для каждого кота */}
          <div key={cat.id} className="cat-card-body">
            <span className="tag swap-in" style={k(0)}>
              {String(selected + 1).padStart(2, '0')} / {count} · {cat.world}
            </span>
            <Title className="cat-name" text={cat.name} letters />
            <p className="cat-subtitle swap-in" style={{ ...k(1), color: cat.accent2 }}>
              {cat.subtitle}
            </p>
            <p className="small cat-story swap-in" style={k(2)}>
              {cat.story}
            </p>
            <dl className="cat-stats swap-in" style={k(3)}>
              <div>
                <dt>Rarity</dt>
                <dd className="rarity">{RARITY_LABEL[cat.rarity]}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{cat.element}</dd>
              </div>
              <div>
                <dt>Power</dt>
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
            <button type="button" className="arrow" aria-label="Previous cat" onClick={() => go(-1)}>
              <ArrowIcon dir={-1} />
            </button>
            <div className="thumbs" ref={thumbsRef} role="tablist" aria-label="Cats">
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
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
            <button type="button" className="arrow" aria-label="Next cat" onClick={() => go(1)}>
              <ArrowIcon />
            </button>
          </div>
        </div>
      </Section>
    </>
  );
}

/** Свайп по сцене у персонажей (по горизонтали), вертикальный жест — прокрутка страницы. */
function SwipeLayer({ onSwipe }: { onSwipe: (step: number) => void }) {
  const active = useAtStation(sectionIndex('cats'));
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

/** 5. Коллекция: всё кольцо котов и пять ступеней редкости — у каждой свой характер. */
export function CollectionSection() {
  return (
    <Section
      id="collection"
      layout="center"
      head={
        <>
          <Label>The collection</Label>
          <Words text="Build your collection" />
          <p className="lead center" data-rv="up" style={k(2)}>
            Every cat is part of a growing collection. Discover new characters, unlock rare skins and build a
            lineup that represents your journey through the world.
          </p>
        </>
      }
    >
      <ul className="tiers">
        {TIERS.map((t, i) => (
          <li
            key={t.rarity}
            className="tier card"
            data-rarity={t.rarity}
            data-rv="rise"
            style={{ ...k(i), ['--r' as string]: RARITY_COLOR[t.rarity] }}
          >
            <span className="tier-gem" aria-hidden />
            <p className="tier-name">{RARITY_LABEL[t.rarity]}</p>
            <p className="small">{t.text}</p>
          </li>
        ))}
      </ul>
      <a
        className="link-cta"
        href={MINI_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-rv="up"
        style={k(5)}
      >
        Explore collection
        <ArrowIcon />
      </a>
    </Section>
  );
}
