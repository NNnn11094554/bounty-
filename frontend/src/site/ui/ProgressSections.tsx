import { CoinIcon } from '../../components/icons';
import { MINI_APP_URL } from '../../lib/links';
import { AIRDROP_REQS, JOURNEY_PILLARS, LEAGUES, sectionIndex } from '../content';
import { useDemo } from '../demo';
import { useT } from '../i18n';
import { CountUp } from './CountUp';
import { DailyRewards } from './DailyRewards';
import { PILLAR_ICONS } from './iconSets';
import { CheckIcon } from './icons';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

const AIRDROP = sectionIndex('airdrop');

/**
 * 5. Airdrop и прогресс — одна секция (одна станция сцены: монета PAW с кольцом прогресса). Слева — как
 * считается участие: реальные требования игры, прогресс демо-игрока и «Проверить прогресс» в Mini App (без
 * обещаний дохода и распределений, без кошелька). Справа — почему хочется вернуться: ежедневная награда (демо,
 * можно забрать), задания дня и лестница лиг (демо-игрок на своей ступени).
 */
export function AirdropSection() {
  const t = useT();
  const ready = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
  const league = useDemo((s) => s.league);
  return (
    <Section
      id="airdrop"
      layout="left"
      className="sec-wide"
      head={
        <>
          <Label>{t.airdrop.label}</Label>
          <Words text={t.airdrop.title} />
          <p className="lead" data-rv="up" style={k(2)}>
            {t.airdrop.lead}
          </p>
        </>
      }
    >
      <div className="journey">
        <div className="journey-col">
          <ul className="pillars">
            {t.airdrop.pillars.map((p, i) => (
              <li key={i} className="card pillar" data-rv="rise" style={k(i * 0.6)}>
                <span className="pillar-icon">{PILLAR_ICONS[JOURNEY_PILLARS[i]!]}</span>
                <div className="min-w-0">
                  <p className="h4">{p.title}</p>
                  <p className="small">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="glass progress-card" data-rv="up" style={k(3)}>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="tag">{t.airdrop.progress}</p>
                <p className="stat-big">
                  <CountUp to={Math.round(ready * 100)} station={AIRDROP} />%
                </p>
              </div>
              <span className="soon">{t.airdrop.example}</span>
            </div>
            <div className="reqs">
              {AIRDROP_REQS.map((r, i) => (
                <div key={r.id} className="req" style={{ ['--d' as string]: `${180 + i * 90}ms` }}>
                  <span className="check" data-done={r.demo >= 1}>
                    {r.demo >= 1 && <CheckIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="req-label">{t.airdrop.reqs[r.id]}</p>
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
          </div>
          <div className="actions items-center" data-rv="up" style={k(4)}>
            <a className="btn btn-primary" href={MINI_APP_URL} target="_blank" rel="noopener noreferrer">
              {t.cta.checkProgress}
            </a>
            <p className="fine">{t.airdrop.fine}</p>
          </div>
        </div>
        <div className="journey-col">
          <div className="journey-head" data-rv="up" style={k(2)}>
            <Label>{t.progress.label}</Label>
            <h3 className="journey-title">{t.progress.title.replaceAll('|', '')}</h3>
            <p className="small">{t.progress.lead}</p>
          </div>
          <div className="journey-cards">
            <div className="glass p-3 sm:p-4" data-rv="up" style={k(3)}>
              <DailyRewards />
            </div>
            <div className="glass tasks" data-rv="up" style={k(4)}>
              <p className="tag">{t.progress.everyDay}</p>
              {t.progress.tasks.map((task) => (
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
            <div className="glass ladder-card" data-rv="up" style={k(5)}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="tag">{t.progress.leagues}</p>
                <p className="detail">{t.progress.leaguesText}</p>
              </div>
              <ol className="ladder" aria-label={t.progress.leagues}>
                {LEAGUES.map((l, i) => (
                  <li
                    key={l.name}
                    data-state={i < league ? 'done' : i === league ? 'now' : 'next'}
                    style={{ ['--l' as string]: l.color, ['--i' as string]: i }}
                    title={l.name}
                  >
                    <span>{l.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
