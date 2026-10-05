import { CoinIcon } from '../../components/icons';
import { AIRDROP_REQS, DAILY_TASKS, JOURNEY_PILLARS, sectionIndex } from '../content';
import { CountUp } from './CountUp';
import { DailyRewards } from './DailyRewards';
import { PILLAR_ICONS } from './iconSets';
import { CheckIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

const AIRDROP = sectionIndex('airdrop');

/**
 * 5. Прогресс и награды: что игра даёт каждый день (награда за серию, задания, друзья) и как это складывается
 * в путь игрока (airdrop). Без обещаний наград, сумм и распределений — только то, что игра уже считает.
 * В сцене — монета PAW в кольцах, без котов.
 */
export function RewardsSection() {
  const ready = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
  return (
    <Section
      id="airdrop"
      layout="center"
      className="rewards"
      head={
        <>
          <Label>Progress &amp; rewards</Label>
          <Words text="Your journey matters" />
          <p className="lead center" data-rv="up" style={k(2)}>
            Your activity, progression and participation become part of your journey through the ecosystem.
            Keep playing. Complete activities. Build your collection. Stay active.
          </p>
        </>
      }
    >
      <div className="rewards-grid">
        <div className="rewards-col">
          <div className="glass p-3 sm:p-4" data-rv="up" style={k(0)}>
            <DailyRewards />
          </div>
          <div className="glass tasks" data-rv="up" style={k(1)}>
            <p className="tag">Every day</p>
            {DAILY_TASKS.map((t) => (
              <div key={t.title} className="task">
                <div className="min-w-0 flex-1">
                  <p className="h4">{t.title}</p>
                  <p className="small">{t.text}</p>
                </div>
                <span className="chip text-[color:var(--gold)]">
                  <CoinIcon size={14} />
                  {t.reward}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rewards-col">
          <ul className="pillars">
            {JOURNEY_PILLARS.map((p, i) => (
              <li key={p.title} className="card pillar" data-rv="rise" style={k(2 + i * 0.5)}>
                <span className="pillar-icon">{PILLAR_ICONS[p.title]}</span>
                <div className="min-w-0">
                  <p className="h4">{p.title}</p>
                  <p className="small">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="glass progress-card" data-rv="up" style={k(4)}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="tag">Airdrop · journey progress</p>
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
        </div>
      </div>
    </Section>
  );
}
