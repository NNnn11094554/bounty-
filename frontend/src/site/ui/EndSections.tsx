import { useId, useState } from 'react';
import { FAQ, NAV, ROADMAP, sectionIndex } from '../content';
import { flyTo } from '../timeline';
import { PawMark, PlayButton, Socials } from './Chrome';
import { CheckIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

const PHASE_STATE: Record<(typeof ROADMAP)[number]['state'], string> = {
  done: 'Live',
  next: 'Next',
  later: 'Later',
  unknown: 'Unknown',
};

/** 9. Roadmap: четыре фазы — маяки в сцене уходят вдаль, последняя мерцает. */
export function RoadmapSection() {
  return (
    <Section
      id="roadmap"
      layout="center"
      head={
        <>
          <Label>What&apos;s next</Label>
          <Words text="Roadmap" />
        </>
      }
    >
      <ol className="phases">
        {ROADMAP.map((p, i) => (
          <li key={p.phase} className="card phase" data-state={p.state} data-rv="rise" style={k(i)}>
            <div className="phase-top">
              <span className="tag">Phase {p.phase}</span>
              <span className="phase-state">{PHASE_STATE[p.state]}</span>
            </div>
            <h3 className="h3">{p.title}</h3>
            <ul className="phase-items">
              {p.items.map((item) => (
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
    </Section>
  );
}

/** 10. Сообщество: коты стоят вместе, под ними — куда идти. */
export function CommunitySection() {
  return (
    <Section
      id="community"
      layout="center"
      head={
        <>
          <Label>Community</Label>
          <Words text="The world is better together" />
          <p className="lead center" data-rv="up" style={k(2)}>
            Follow the journey, discover new characters and become part of the community as the universe
            continues to grow.
          </p>
        </>
      }
    >
      <div data-rv="up" style={k(3)}>
        <Socials wide className="community-links" />
      </div>
    </Section>
  );
}

/** 11. Вопросы: аккордеон, открыт один вопрос за раз. */
export function FaqSection() {
  const [open, setOpen] = useState(0);
  const base = useId();
  return (
    <Section
      id="faq"
      layout="right"
      head={
        <>
          <Label>Questions</Label>
          <Words text="FAQ" />
        </>
      }
    >
      <div className="faq glass" data-rv="up" style={k(2)}>
        {FAQ.map((item, i) => {
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

/** 12. Финал: самый сильный кот в портале и одна кнопка. */
export function FinalSection() {
  return (
    <Section id="final" layout="center" className="final">
      <Label>Meowgul</Label>
      <Words text="The world is just beginning" />
      <p className="lead center" data-rv="up" style={k(2)}>
        Your journey starts with a single tap.
      </p>
      <div className="actions justify-center" data-rv="up" style={k(3)}>
        <PlayButton />
      </div>
    </Section>
  );
}

/** 13. Подвал: разделы, ссылки, оговорка об игровых предметах. */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <button type="button" className="logo" onClick={() => flyTo(0)} aria-label="Meowgul — home">
            <PawMark />
            MEOWGUL
          </button>
          <p className="small">A Telegram game about cats, collecting and a growing universe.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={(e) => {
                e.preventDefault();
                flyTo(sectionIndex(n.id));
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <Socials />
      </div>
      <div className="footer-fine">
        <p>© {new Date().getFullYear()} Meowgul</p>
        <p>PAW and in-game assets are game items: they cannot be withdrawn, sold or transferred.</p>
      </div>
    </footer>
  );
}
