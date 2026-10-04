import { catAsset } from '../cats';
import { AIRDROP_REQS, JOURNEY_PILLARS, PROGRESSION, WORLDS, sectionIndex } from '../content';
import { CountUp } from './CountUp';
import { DailyRewards } from './DailyRewards';
import { PATH_ICONS, PILLAR_ICONS } from './iconSets';
import { CheckIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

/** 6. Мир: вселенная растёт. Все миры — будущие, так и подписаны. */
export function WorldSection() {
  return (
    <Section
      id="world"
      layout="left"
      head={
        <>
          <Label>The world</Label>
          <Words text="A world with no final level" />
          <p className="lead" data-rv="up" style={k(2)}>
            Beyond the main game lies a growing universe of characters, locations, events and discoveries. New
            worlds will introduce new characters, mechanics and ways to play.
          </p>
        </>
      }
    >
      <ul className="worlds">
        {WORLDS.map((w, i) => (
          <li key={w.name} className="world card" data-unknown={!w.cat} data-rv="rise" style={k(i)}>
            {w.cat ? (
              <picture className="world-art" aria-hidden>
                <source type="image/avif" srcSet={catAsset(w.cat, 'background', 1200, 'avif')} />
                <img
                  src={catAsset(w.cat, 'background', 1200, 'webp')}
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
              <span className="soon">{w.cat ? 'Coming soon' : 'Undiscovered'}</span>
              <h3 className="h3">{w.name}</h3>
              <p className="small">{w.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** 7. Прогресс: путь игрока от уровня до достижений и ежедневная награда (демо). */
export function ProgressionSection() {
  return (
    <Section
      id="progression"
      layout="left"
      head={
        <>
          <Label>Progression</Label>
          <Words text="Your journey starts here" />
          <p className="lead" data-rv="up" style={k(2)}>
            Begin with a single cat and grow your way through the universe.
          </p>
          <p className="motto" data-rv="up" style={k(3)}>
            Earn. Upgrade. Unlock. Repeat.
          </p>
        </>
      }
    >
      <ol className="path" data-rv="line">
        {PROGRESSION.map((p, i) => (
          <li key={p.title} data-rv="up" style={k(i)}>
            <span className="path-icon">{PATH_ICONS[p.title]}</span>
            <div className="min-w-0">
              <p className="h4">{p.title}</p>
              <p className="small">{p.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="glass p-3 sm:p-4" data-rv="up" style={k(6)}>
        <DailyRewards />
      </div>
    </Section>
  );
}

const AIRDROP = sectionIndex('airdrop');

/**
 * 8. Airdrop: путь игрока как часть экосистемы. Без обещаний наград, сумм и распределений — только
 * то, что игра уже считает (требования из игры, демо-прогресс), остальное — «Coming soon».
 */
export function AirdropSection() {
  const ready = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
  return (
    <Section
      id="airdrop"
      layout="right"
      head={
        <>
          <Label>Airdrop</Label>
          <Words text="Your journey matters" />
          <p className="lead" data-rv="up" style={k(2)}>
            Your activity, progression and participation become part of your journey through the ecosystem.
          </p>
          <p className="motto" data-rv="up" style={k(3)}>
            Keep playing. Complete activities. Build your collection. Stay active.
          </p>
        </>
      }
    >
      <ul className="pillars">
        {JOURNEY_PILLARS.map((p, i) => (
          <li key={p.title} className="card pillar" data-rv="rise" style={k(i)}>
            <span className="pillar-icon">{PILLAR_ICONS[p.title]}</span>
            <p className="h4">{p.title}</p>
            <p className="small">{p.text}</p>
          </li>
        ))}
      </ul>
      <div className="glass progress-card" data-rv="up" style={k(4)}>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="tag">Journey progress</p>
            <p className="stat-big">
              <CountUp to={Math.round(ready * 100)} station={AIRDROP} />%
            </p>
          </div>
          <span className="soon">Example player</span>
        </div>
        <div className="reqs">
          {AIRDROP_REQS.map((r, i) => (
            <div key={r.id} className="req" style={{ ['--d' as string]: `${180 + i * 90}ms` }}>
              <span className="check" data-done={r.demo >= 1}>
                {r.demo >= 1 && <CheckIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="req-label">{r.label}</p>
                {r.demo < 1 && (
                  <div
                    className="bar req-bar mt-1.5"
                    style={{
                      height: 3,
                      ['--from' as string]: '#a66bff',
                      ['--to' as string]: '#7fe3ff',
                      ['--v' as string]: r.demo,
                    }}
                  >
                    <i />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="fine">
          Airdrop details: coming soon, announced as the system develops. Nothing here is a promise of
          rewards.
        </p>
      </div>
    </Section>
  );
}
