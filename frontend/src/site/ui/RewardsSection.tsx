import { CoinIcon } from '../../components/icons';
import { AIRDROP_REQS, JOURNEY_PILLARS, sectionIndex } from '../content';
import { useT } from '../i18n';
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
  const t = useT();
  const ready = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
  return (
    <Section
      id="airdrop"
      layout="left"
      className="rewards sec-wide"
      head={
        <>
          <Label>{t.rewards.label}</Label>
          <Words text={t.rewards.title} />
          <p className="lead" data-rv="up" style={k(2)}>
            {t.rewards.lead}
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
            <p className="tag">{t.rewards.everyDay}</p>
            {t.rewards.tasks.map((task) => (
              <div key={task.title} className="task">
                <div className="min-w-0 flex-1">
                  <p className="h4">{task.title}</p>
                  <p className="small">{task.text}</p>
                </div>
                <span className="chip text-[color:var(--gold)]">
                  <CoinIcon size={14} />
                  {task.reward}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rewards-col">
          <ul className="pillars">
            {t.rewards.pillars.map((p, i) => (
              <li key={i} className="card pillar" data-rv="rise" style={k(2 + i * 0.5)}>
                <span className="pillar-icon">{PILLAR_ICONS[JOURNEY_PILLARS[i]!]}</span>
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
                <p className="tag">{t.rewards.progress}</p>
                <p className="stat-big">
                  <CountUp to={Math.round(ready * 100)} station={AIRDROP} />%
                </p>
              </div>
              <span className="soon">{t.rewards.example}</span>
            </div>
            <div className="reqs">
              {AIRDROP_REQS.map((r, i) => (
                <div key={r.id} className="req" style={{ ['--d' as string]: `${180 + i * 90}ms` }}>
                  <span className="check" data-done={r.demo >= 1}>
                    {r.demo >= 1 && <CheckIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="req-label">{t.rewards.reqs[r.id]}</p>
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
            <p className="fine">{t.rewards.fine}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
