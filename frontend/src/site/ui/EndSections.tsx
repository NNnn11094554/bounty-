import { useId, useState } from 'react';
import { catAsset } from '../cats';
import { NAV, ROADMAP, WORLDS, sectionIndex } from '../content';
import { fmt, useT } from '../i18n';
import { flyTo } from '../timeline';
import { PawMark, PlayButton, Socials } from './Chrome';
import { CheckIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

/**
 * 6. Roadmap и будущее: четыре фазы и миры, которые готовятся (все — с пометкой Coming soon, не выдаются за
 * готовые). В сцене — маяки фаз уходят вдаль, последний мерцает.
 */
export function RoadmapSection() {
  const t = useT();
  return (
    <Section
      id="roadmap"
      layout="center"
      head={
        <>
          <Label>{t.roadmap.label}</Label>
          <Words text={t.roadmap.title} />
          <p className="lead center" data-rv="up" style={k(2)}>
            {t.roadmap.lead}
          </p>
        </>
      }
    >
      <ol className="phases">
        {ROADMAP.map((p, i) => (
          <li key={p.phase} className="card phase" data-state={p.state} data-rv="rise" style={k(i)}>
            <div className="phase-top">
              <span className="tag">{fmt(t.roadmap.phase, { n: p.phase })}</span>
              <span className="phase-state">{t.roadmap.states[p.state]}</span>
            </div>
            <h3 className="h3">{t.roadmap.phases[i]!.title}</h3>
            <ul className="phase-items">
              {t.roadmap.phases[i]!.items.map((item) => (
                <li key={item}>
                  <span className="phase-mark" aria-hidden>
                    {p.state === 'done' ? <CheckIcon /> : null}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="worlds-block" data-rv="up" style={k(4)}>
        <p className="tag">{t.roadmap.worlds}</p>
        <ul className="worlds">
          {WORLDS.map((cat, i) => (
            <li key={i} className="world" data-unknown={!cat}>
              {cat ? (
                <picture className="world-art" aria-hidden>
                  <source type="image/avif" srcSet={catAsset(cat, 'background', 1200, 'avif')} />
                  <img
                    src={catAsset(cat, 'background', 1200, 'webp')}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={600}
                    height={760}
                  />
                </picture>
              ) : (
                <span className="world-art world-void" aria-hidden>
                  ?
                </span>
              )}
              <div className="world-text">
                <span className="soon">{cat ? t.roadmap.soon : t.roadmap.undiscovered}</span>
                <h3 className="h4">{t.roadmap.worldList[i]!.name}</h3>
                <p className="small">{t.roadmap.worldList[i]!.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/**
 * 7. Сообщество и вопросы: куда идти и короткие ответы. В сцене — пятеро котов вместе (не те, что рядом).
 */
export function CommunitySection() {
  const t = useT();
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <Section
      id="community"
      layout="right"
      head={
        <>
          <Label>{t.community.label}</Label>
          <Words text={t.community.title} />
          <p className="lead" data-rv="up" style={k(2)}>
            {t.community.lead}
          </p>
        </>
      }
    >
      <div data-rv="up" style={k(3)}>
        <Socials wide className="community-links" />
      </div>
      <div className="faq glass" data-rv="up" style={k(4)}>
        <p className="tag faq-title">{t.community.faq}</p>
        {t.community.items.map((item, i) => {
          const expanded = open === i;
          return (
            <div key={item.q} className="faq-item" data-open={expanded}>
              <h3>
                <button
                  type="button"
                  id={`${base}-q${i}`}
                  aria-expanded={expanded}
                  aria-controls={`${base}-a${i}`}
                  onClick={() => setOpen(expanded ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <i aria-hidden />
                </button>
              </h3>
              <div
                id={`${base}-a${i}`}
                role="region"
                aria-labelledby={`${base}-q${i}`}
                className="faq-answer"
                aria-hidden={!expanded}
              >
                <div>
                  <p className="small">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** 8. Финал: самый сильный кот в портале и одна кнопка. */
export function FinalSection() {
  const t = useT();
  return (
    <Section id="final" layout="center" className="final">
      <Label>Meowgul</Label>
      <Words text={t.final.title} />
      <p className="lead center" data-rv="up" style={k(2)}>
        {t.final.lead}
      </p>
      <div className="actions justify-center" data-rv="up" style={k(3)}>
        <PlayButton />
      </div>
    </Section>
  );
}

/** Подвал: разделы, ссылки, оговорка об игровых предметах. */
export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <button type="button" className="logo" onClick={() => flyTo(0)} aria-label={t.nav.homeAria}>
            <PawMark />
            MEOWGUL
          </button>
          <p className="small">{t.footer.about}</p>
        </div>
        <nav className="footer-nav" aria-label={t.footer.nav}>
          {NAV.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                flyTo(sectionIndex(id));
              }}
            >
              {t.nav[id]}
            </a>
          ))}
        </nav>
        <Socials />
      </div>
      <div className="footer-fine">
        <p>© {new Date().getFullYear()} Meowgul</p>
        <p>{t.footer.fine}</p>
      </div>
    </footer>
  );
}
