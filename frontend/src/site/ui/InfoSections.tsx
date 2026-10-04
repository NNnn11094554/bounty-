import { formatShort } from '@meowgul/shared';
import { EnergyLimitIcon, FullEnergyIcon, TurboIcon } from '../../components/boostIcons';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { AIRDROP_REQS, ASSET_GROUPS, GAME_FACTS, TASKS } from '../content';
import { PlayButton } from './Chrome';
import { StationPanel } from './StationPanel';
import { Title } from './Title';

const k = (n: number) => ({ ['--k' as string]: n });

/** Прокачка: категории активов (те же монеты, что в игре) и бусты. */
export function UpgradesSection() {
  return (
    <StationPanel index={3} label="Прокачка">
      <div className="dock dock-left station-inner">
        <p className="kicker reveal" style={k(0)}>
          Прокачка · {GAME_FACTS.assets} активов
        </p>
        <Title className="h2 reveal" style={k(1)} text="Строй свою криптоимперию" />
        <p className="lead reveal wide-only" style={k(2)}>
          Покупай и улучшай игровые активы — каждый приносит PAW в час. Доход копится, даже пока тебя нет, до
          3 часов.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {ASSET_GROUPS.map((g, i) => (
            <div key={g.title} className="glass reveal flex items-center gap-3 p-3" style={k(3 + i * 0.5)}>
              <CardIcon icon={g.icon} size={40} />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ fontFamily: 'var(--display)' }}>
                  {g.title}
                </p>
                <p className="mono truncate text-[10px] tracking-[0.06em] text-[color:var(--ink-3)]">
                  {g.examples}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="glass reveal wide-only tall-only p-4" style={k(5)}>
          <p className="stat-label mb-3">Бусты</p>
          <div className="flex flex-col gap-3">
            <Boost
              icon={<TurboIcon size={34} />}
              title="Turbo"
              text={`×${GAME_FACTS.turbo.multiplier} за тап на ${GAME_FACTS.turbo.seconds} с, энергия не тратится`}
            />
            <Boost
              icon={<FullEnergyIcon size={34} />}
              title="Full energy"
              text={`полная энергия ${GAME_FACTS.fullEnergy.perDay} раз в день`}
            />
            <Boost
              icon={<EnergyLimitIcon size={34} />}
              title="Energy limit"
              text="+500 энергии за каждый уровень"
            />
          </div>
        </div>
      </div>
    </StationPanel>
  );
}

function Boost({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ fontFamily: 'var(--display)' }}>
          {title}
        </p>
        <p className="text-[13px] text-[color:var(--ink-2)]">{text}</p>
      </div>
    </div>
  );
}

/** день серии, который «сегодня» в демо */
const TODAY = 4;

/** Задания: ежедневная награда по дням серии и задания. */
export function EarnSection() {
  return (
    <StationPanel index={4} label="Задания">
      <div className="dock dock-right station-inner">
        <p className="kicker reveal" style={k(0)}>
          Earn · награды каждый день
        </p>
        <Title className="h2 reveal" style={k(1)} text="Заходи каждый день" />
        <p className="lead reveal wide-only" style={k(2)}>
          Серия из 10 дней: чем дольше не пропускаешь, тем больше награда.
        </p>
        <div className="glass reveal p-3 sm:p-4" style={k(3)}>
          <div className="mb-3 flex items-center justify-between">
            <p className="stat-label">Ежедневная награда</p>
            <p className="stat-label">день {TODAY} из 10</p>
          </div>
          <div className="days">
            {GAME_FACTS.daily.map((amount, i) => {
              const day = i + 1;
              const state = day < TODAY ? 'done' : day === TODAY ? 'today' : 'next';
              return (
                <div key={day} className="day" data-state={state}>
                  <p className="mono text-[9px] tracking-[0.14em] text-[color:var(--ink-3)]">ДЕНЬ {day}</p>
                  <CoinIcon size={18} className="mx-auto my-1" />
                  <p className="num text-[12px] font-semibold">{formatShort(amount)}</p>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass reveal wide-only tall-only px-4 py-1" style={k(4)}>
          {TASKS.map((task) => (
            <div key={task.title} className="row">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{task.title}</p>
                <p className="text-[12px] text-[color:var(--ink-3)]">{task.note}</p>
              </div>
              <span className="chip text-[color:var(--gold)]">
                <CoinIcon size={14} />
                {task.reward}
              </span>
            </div>
          ))}
        </div>
      </div>
    </StationPanel>
  );
}

/** Airdrop: очки, готовность и требования. Кошелёк пока не подключается. */
export function AirdropSection() {
  const ready = AIRDROP_REQS.reduce((s, r) => s + r.demo, 0) / AIRDROP_REQS.length;
  return (
    <StationPanel index={5} label="Airdrop">
      <div className="dock dock-left station-inner">
        <p className="kicker reveal" style={k(0)}>
          Airdrop
        </p>
        <Title className="h2 reveal" style={k(1)} text="Копи очки Airdrop" />
        <p className="lead reveal wide-only" style={k(2)}>
          Листинг уже в пути. Очки Airdrop — это все монеты, что ты заработал. Выполняй требования, чтобы
          участвовать.
        </p>
        <div className="glass reveal p-4" style={k(3)}>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="stat-label">Готовность</p>
              <p className="num text-[34px] font-bold leading-none" style={{ color: '#c9b8ff' }}>
                {Math.round(ready * 100)}%
              </p>
            </div>
            <p className="stat-label text-right">демо-игрок</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6">
            {AIRDROP_REQS.map((r) => (
              <div key={r.id} className="row">
                <span className="check" data-done={r.demo >= 1}>
                  {r.demo >= 1 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path
                        d="M2.5 6.2 5 8.6l4.6-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium leading-snug sm:text-[13px]">{r.label}</p>
                  {r.demo < 1 && (
                    <div
                      className="bar mt-1.5"
                      style={{ height: 3, ['--from' as string]: '#a66bff', ['--to' as string]: '#7fe3ff' }}
                    >
                      <i style={{ transform: `scaleX(${r.demo})` }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="reveal flex flex-wrap items-center gap-4" style={k(4)}>
          <PlayButton />
          <p className="max-w-[34ch] text-[11px] leading-relaxed text-[color:var(--ink-3)]">
            PAW и активы — игровые предметы: их нельзя вывести, продать или перевести.
          </p>
        </div>
      </div>
    </StationPanel>
  );
}
