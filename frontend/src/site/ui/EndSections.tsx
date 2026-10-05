import { useId, useState } from 'react';
import { LINKS, NAV, PARTNER_METRICS, PARTNER_OFFERS, ROADMAP, sectionIndex } from '../content';
import { useT } from '../i18n';
import { flyTo } from '../timeline';
import { PawMark, PlayButton } from './Chrome';
import { PARTNER_ICONS } from './iconSets';
import { CheckIcon, CommunityIcon, TelegramIcon, XIcon } from './icons';
import { LangSwitch } from './LangSwitch';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

/**
 * 7. Партнёрство: для брендов и проектов — что даёт Telegram-игра, метрики (только реальные: из
 * PARTNER_METRICS, пока их нет — «по запросу») и контакт. В сцене — Galaxy Emperor в портале.
 */
export function PartnersSection() {
  const t = useT();
  return (
    <Section
      id="partners"
      layout="left"
      className="sec-wide"
      head={
        <>
          <Label>{t.partners.label}</Label>
          <Words text={t.partners.title} />
          <p className="lead" data-rv="up" style={k(2)}>
            {t.partners.lead}
          </p>
        </>
      }
    >
      <ul className="offers">
        {t.partners.offers.map((o, i) => (
          <li key={i} className="offer" data-rv="rise" style={k(i * 0.5)}>
            <span className="offer-icon">{PARTNER_ICONS[PARTNER_OFFERS[i]!]}</span>
            <div className="min-w-0">
              <h3 className="h4">{o.title}</h3>
              <p className="small">{o.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="metrics" data-rv="up" style={k(3)}>
        {(Object.keys(PARTNER_METRICS) as Array<keyof typeof PARTNER_METRICS>).map((key) => (
          <div key={key} data-empty={!PARTNER_METRICS[key]}>
            <dt className="tag">{t.partners.metrics[key]}</dt>
            <dd className="metric-value">{PARTNER_METRICS[key] ?? t.partners.onRequest}</dd>
          </div>
        ))}
      </dl>
      <div className="actions items-center" data-rv="up" style={k(4)}>
        <a className="btn btn-primary" href={LINKS.partner} target="_blank" rel="noopener noreferrer">
          {t.cta.partner}
        </a>
        <p className="fine">{t.partners.contact}</p>
      </div>
    </Section>
  );
}

/** 8. Roadmap: пять этапов, «Live» — только у того, что уже работает. В сцене — маяки этапов. */
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
      <ol className="milestones">
        {t.roadmap.stages.map((stage, i) => {
          const state = ROADMAP[i]!;
          return (
            <li key={i} className="milestone" data-state={state} data-rv="rise" style={k(i * 0.6)}>
              <div className="milestone-top">
                <span className="milestone-dot" aria-hidden>
                  {state === 'done' && <CheckIcon />}
                </span>
                <span className="milestone-state">{t.roadmap.states[state]}</span>
              </div>
              <h3 className="h3">{stage.title}</h3>
              <ul className="milestone-items">
                {stage.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

/** Каналы: Telegram — главный (крупно), остальные — пока их нет, «Скоро», без ссылки в никуда. */
function Channels() {
  const t = useT();
  const others = [
    { id: 'x', href: LINKS.x, icon: <XIcon /> },
    { id: 'community', href: LINKS.community, icon: <CommunityIcon /> },
  ] as const;
  return (
    <div className="channels">
      <a className="channel-main" href={LINKS.telegram} target="_blank" rel="noopener noreferrer">
        <span className="channel-icon">
          <TelegramIcon size={26} />
        </span>
        <span className="min-w-0">
          <span className="tag">{t.social.main}</span>
          <span className="channel-name">Telegram</span>
        </span>
      </a>
      {others.map((o) =>
        o.href ? (
          <a key={o.id} className="btn btn-ghost" href={o.href} target="_blank" rel="noopener noreferrer">
            {o.icon}
            {t.social[o.id]}
          </a>
        ) : (
          <span key={o.id} className="btn btn-ghost is-soon" aria-disabled="true">
            {o.icon}
            {t.social[o.id]}
            <small>{t.social.soon}</small>
          </span>
        ),
      )}
    </div>
  );
}

/** 9. Сообщество и вопросы: Telegram — главный канал, короткий FAQ-аккордеон. В сцене — коты вместе. */
export function CommunitySection() {
  const t = useT();
  const [open, setOpen] = useState(-1);
  const base = useId();
  return (
    <Section
      id="community"
      layout="right"
      className="sec-wide"
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
      <div className="split">
        <div data-rv="up" style={k(3)}>
          <Channels />
        </div>
        <div className="faq glass" data-rv="up" style={k(4)}>
          <p className="tag faq-title">{t.community.faq}</p>
          {t.community.items.map((item, i) => {
            const expanded = open === i;
            return (
              <div key={i} className="faq-item" data-open={expanded}>
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
      </div>
    </Section>
  );
}

/**
 * Подвал: слоган и «Играть» — финальный призыв, дальше бренд, разделы, каналы, партнёрство и язык.
 * Страниц Privacy/Terms у проекта нет — ссылок на них тоже нет.
 */
export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <div className="footer-cta">
        <p className="footer-slogan">{t.footer.slogan}</p>
        <PlayButton className="btn-lg" />
      </div>
      <div className="footer-grid">
        <div className="footer-brand">
          <button type="button" className="logo" onClick={() => flyTo(0)} aria-label={t.nav.homeAria}>
            <PawMark />
            MEOWGUL
          </button>
          <p className="small">{t.footer.about}</p>
          <LangSwitch up />
        </div>
        <nav className="footer-col" aria-label={t.footer.nav}>
          <p className="tag">{t.footer.navigate}</p>
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
        <div className="footer-col">
          <p className="tag">{t.footer.connect}</p>
          <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer">
            Telegram
          </a>
          {LINKS.x ? (
            <a href={LINKS.x} target="_blank" rel="noopener noreferrer">
              X
            </a>
          ) : (
            <span className="is-soon">X · {t.social.soon}</span>
          )}
        </div>
        <div className="footer-col">
          <p className="tag">{t.footer.partnership}</p>
          <a
            href="#partners"
            onClick={(e) => {
              e.preventDefault();
              flyTo(sectionIndex('partners'));
            }}
          >
            {t.partners.title}
          </a>
          <a href={LINKS.partner} target="_blank" rel="noopener noreferrer">
            {t.cta.partner}
          </a>
        </div>
      </div>
      <div className="footer-fine">
        <p>© {new Date().getFullYear()} Meowgul</p>
        <p>{t.footer.fine}</p>
      </div>
    </footer>
  );
}
