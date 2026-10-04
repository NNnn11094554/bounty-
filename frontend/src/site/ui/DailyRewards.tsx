import { formatInt, formatShort } from '@meowgul/shared';
import { useRef, useState } from 'react';
import { CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { GAME_FACTS } from '../content';
import { demoAdd, demoBalance } from '../demo';

/** день серии, который «сегодня» в демо */
const TODAY = 4;

/**
 * Ежедневная награда: сегодняшний день мягко пульсирует; по нажатию — короткая вспышка искр, монеты
 * перелетают к балансу, число прокручивается. Всё — transform и opacity (Web Animations), без раскладки.
 */
export function DailyRewards() {
  const [claimed, setClaimed] = useState(false);
  const balanceRef = useRef<HTMLSpanElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const claim = () => {
    if (claimed) return;
    setClaimed(true);
    const from = todayRef.current?.getBoundingClientRect();
    const to = balanceRef.current?.getBoundingClientRect();
    const amount = GAME_FACTS.daily[TODAY - 1]!;
    if (!from || !to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      demoAdd(amount);
      return;
    }
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    sparks(cx, cy);
    coinsTo(cx, cy, to.left + 10, to.top + to.height / 2, () => demoAdd(amount));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="tag">Daily reward · day {TODAY} of 10</p>
        <span className="chip text-[color:var(--gold)]" ref={balanceRef}>
          <CoinIcon size={14} />
          <RollingNumber getValue={demoBalance} glowOnJump={false} />
        </span>
      </div>
      <div className="days">
        {GAME_FACTS.daily.map((amount, i) => {
          const day = i + 1;
          const state = day < TODAY || (day === TODAY && claimed) ? 'done' : day === TODAY ? 'today' : 'next';
          const label = `Day ${day}: ${formatInt(amount)} PAW`;
          const body = (
            <>
              <p className="tag text-[9px]">Day {day}</p>
              <CoinIcon size={18} className="mx-auto my-1" />
              <p className="tabular text-[12px] font-bold">{formatShort(amount)}</p>
            </>
          );
          return day === TODAY && !claimed ? (
            <button
              key={day}
              ref={todayRef}
              type="button"
              className="day day-claim"
              data-state={state}
              aria-label={`${label} — claim`}
              onClick={claim}
            >
              {body}
            </button>
          ) : (
            <div key={day} className="day" data-state={state} aria-label={label}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Короткая вспышка искр из центра плитки. */
function sparks(x: number, y: number): void {
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('i');
    el.className = 'spark';
    document.body.appendChild(el);
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const r = 26 + Math.random() * 22;
    el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * r}px, ${y + Math.sin(a) * r}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    ).onfinish = () => el.remove();
  }
}

/** Монеты по дуге к балансу; когда долетает последняя — награда зачисляется. */
function coinsTo(x0: number, y0: number, x1: number, y1: number, done: () => void): void {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'fly-coin';
    document.body.appendChild(el);
    const lift = 40 + Math.random() * 30;
    const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 40;
    const my = Math.min(y0, y1) - lift;
    const anim = el.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 8}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${mx}px, ${my}px) scale(0.9)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.5)`, opacity: 0.2 },
      ],
      { duration: 700, delay: i * 55, easing: 'cubic-bezier(0.55, 0, 0.35, 1)', fill: 'backwards' },
    );
    anim.onfinish = () => {
      el.remove();
      if (i === n - 1) done();
    };
  }
}
