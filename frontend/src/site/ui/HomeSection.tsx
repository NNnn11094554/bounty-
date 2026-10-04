import { GAME_FACTS } from '../content';
import { flyTo } from '../timeline';
import { PlayButton } from './Chrome';
import { StationPanel } from './StationPanel';

const TITLE = 'MEOWGUL';

const k = (n: number) => ({ ['--k' as string]: n });

/** Главная: имя игры буква за буквой из размытия, коротко о сути, кнопки. Кот — в сцене, справа. */
export function HomeSection() {
  return (
    <StationPanel index={0} label="Meowgul" afterIntro>
      <div className="home">
        <div className="home-text station-inner">
          <p className="kicker intro-fade" style={k(0)}>
            Telegram · Tap · Collect · Earn
          </p>
          <h1 className="hero-title" aria-label={TITLE}>
            {TITLE.split('').map((ch, i) => (
              <span key={i} style={k(i)} aria-hidden>
                {ch}
              </span>
            ))}
          </h1>
          <p className="lead intro-fade" style={k(1)}>
            Чёрный кот и его криптоимперия. Тапай кота, собирай персонажей, прокачивай активы и копи очки
            Airdrop — прямо в Telegram.
          </p>
          <div className="home-actions intro-fade wide-only" style={k(2)}>
            <PlayButton />
            <button type="button" className="btn btn-ghost" onClick={() => flyTo(2)}>
              Смотреть котов
            </button>
          </div>
          <div className="home-stats intro-fade wide-only" style={k(3)}>
            <Stat value={GAME_FACTS.leagues} label="лиг" />
            <Stat value={GAME_FACTS.maxLevel} label="уровней" />
            <Stat value={GAME_FACTS.assets} label="активов" />
          </div>
        </div>
        <div className="home-bottom station-inner portrait-only">
          <div className="home-actions intro-fade" style={k(2)}>
            <PlayButton className="flex-1" />
            <button type="button" className="btn btn-ghost" onClick={() => flyTo(2)}>
              Коты
            </button>
          </div>
        </div>
        <div className="home-hint scroll-hint intro-fade" style={k(4)} aria-hidden>
          ЛИСТАЙТЕ
          <i />
        </div>
      </div>
    </StationPanel>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
