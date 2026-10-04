import { formatInt, formatShort, levelThreshold } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { FullEnergyIcon, TurboIcon } from '../../components/boostIcons';
import { BoltIcon, CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { GAME_FACTS, LEAGUES } from '../content';
import {
  demoBalance,
  demoEnergy,
  demoTap,
  isTurbo,
  refillEnergy,
  startTurbo,
  turboSeconds,
  useDemo,
} from '../demo';
import { sceneApi } from '../store';
import { nearness, onTick } from '../timeline';
import { useAtStation } from './hooks';
import { StationPanel } from './StationPanel';

const k = (n: number) => ({ ['--k' as string]: n });
/** номер станции игры */
const GAME = 1;

/** Игра: интерфейс вокруг кота — баланс, лига, уровень, бусты, энергия. Тапают по самому коту. */
export function GameSection() {
  return (
    <>
      <TapLayer />
      <StationPanel index={1} label="Игра">
        <div className="hud">
          <div className="hud-top station-inner reveal" style={k(0)}>
            <p className="kicker justify-center">Игра · демо</p>
            <div className="balance mt-2">
              <CoinIcon size={40} />
              <RollingNumber getValue={demoBalance} glowOnJump={false} />
            </div>
            <p className="mono mt-1 text-[11px] tracking-[0.16em] text-[color:var(--ink-3)]">
              PAW · +36 000 В ЧАС ОТ АКТИВОВ
            </p>
          </div>
          <div className="hud-left station-inner">
            <LeagueCard />
            <LevelCard />
          </div>
          <div className="hud-right station-inner">
            <TurboButton />
            <FullEnergyButton />
          </div>
          <div className="hud-bottom station-inner reveal" style={k(4)}>
            <EnergyBar />
          </div>
        </div>
      </StationPanel>
      <TapHint />
    </>
  );
}

function LeagueCard() {
  const league = useDemo((s) => s.league);
  const balanceRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const current = LEAGUES[league]!;
  const next = LEAGUES[league + 1];
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции игры панель скрыта — DOM не трогаем
        if (Math.abs(v.pos - GAME) > 0.6) return;
        if (!next || !balanceRef.current || !leftRef.current) return;
        const total = demoBalance();
        const ratio = Math.min(1, (total - current.threshold) / (next.threshold - current.threshold));
        balanceRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
        const text = formatShort(Math.max(0, next.threshold - total));
        if (leftRef.current.textContent !== text) leftRef.current.textContent = text;
      }),
    [current, next],
  );
  return (
    <div className="glass stat reveal" style={k(1)}>
      <p className="stat-label">Лига</p>
      <p className="stat-value" style={{ color: current.color }}>
        {current.name}
      </p>
      <div
        className="bar"
        style={{ ['--from' as string]: current.color, ['--to' as string]: next?.color ?? current.color }}
      >
        <i ref={balanceRef} />
      </div>
      {next && (
        <p className="stat-label mt-2 normal-case tracking-normal">
          до {next.name}: <span ref={leftRef} />
        </p>
      )}
    </div>
  );
}

function LevelCard() {
  const level = useDemo((s) => s.level);
  const barRef = useRef<HTMLElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции игры панель скрыта — DOM не трогаем
        if (Math.abs(v.pos - GAME) > 0.6) return;
        if (!barRef.current) return;
        const from = levelThreshold(level.level);
        const to = levelThreshold(level.level + 1);
        const ratio = to > from ? Math.min(1, (demoBalance() - from) / (to - from)) : 1;
        barRef.current.style.transform = `scaleX(${ratio.toFixed(4)})`;
      }),
    [level.level],
  );
  return (
    <div className="glass stat reveal" style={k(2)}>
      <p className="stat-label">Уровень</p>
      <p className="stat-value">
        {level.level} <span className="text-[color:var(--ink-3)]">/ {GAME_FACTS.maxLevel}</span>
      </p>
      <div className="bar" style={{ ['--from' as string]: '#7fe3ff', ['--to' as string]: '#a66bff' }}>
        <i ref={barRef} />
      </div>
    </div>
  );
}

function TurboButton() {
  const left = useDemo((s) => s.turboLeft);
  const active = useDemo((s) => s.turboActive);
  const timeRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции игры панель скрыта — DOM не трогаем
        if (Math.abs(v.pos - GAME) > 0.6) return;
        if (!timeRef.current) return;
        const s = Math.ceil(turboSeconds());
        const text =
          s > 0
            ? `0:${String(s).padStart(2, '0')}`
            : `×${GAME_FACTS.turbo.multiplier} · ${GAME_FACTS.turbo.seconds} с`;
        if (timeRef.current.textContent !== text) timeRef.current.textContent = text;
      }),
    [],
  );
  return (
    <button
      type="button"
      className="glass boost reveal"
      style={k(3)}
      data-active={active}
      disabled={left <= 0 && !active}
      onClick={() => startTurbo()}
    >
      <TurboIcon size={40} />
      <span className="min-w-0">
        <span className="stat-label block">Turbo</span>
        <span
          className="block text-[15px] font-semibold"
          style={{ fontFamily: 'var(--display)' }}
          ref={timeRef}
        />
        <span className="stat-label block normal-case tracking-normal">
          {left} из {GAME_FACTS.turbo.perDay} на сегодня
        </span>
      </span>
    </button>
  );
}

function FullEnergyButton() {
  const left = useDemo((s) => s.fullLeft);
  return (
    <button
      type="button"
      className="glass boost reveal"
      style={k(4)}
      disabled={left <= 0}
      onClick={() => refillEnergy()}
    >
      <FullEnergyIcon size={40} />
      <span className="min-w-0">
        <span className="stat-label block">Full energy</span>
        <span className="block text-[15px] font-semibold" style={{ fontFamily: 'var(--display)' }}>
          Полная энергия
        </span>
        <span className="stat-label block normal-case tracking-normal">
          {left} из {GAME_FACTS.fullEnergy.perDay} на сегодня
        </span>
      </span>
    </button>
  );
}

function EnergyBar() {
  const fillRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции игры панель скрыта — DOM не трогаем
        if (Math.abs(v.pos - GAME) > 0.6) return;
        const e = demoEnergy();
        const turbo = isTurbo();
        if (fillRef.current)
          fillRef.current.style.transform = `scaleX(${(turbo ? 1 : e / GAME_FACTS.energy.max).toFixed(4)})`;
        const text = turbo
          ? 'TURBO — энергия не тратится'
          : `${formatInt(Math.floor(e))} / ${formatInt(GAME_FACTS.energy.max)}`;
        if (textRef.current && textRef.current.textContent !== text) textRef.current.textContent = text;
      }),
    [],
  );
  return (
    <div className="glass px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[color:var(--gold)]">
          <BoltIcon size={18} />
          <span className="stat-label">Энергия</span>
        </span>
        <span className="mono text-[13px]" ref={textRef} />
      </div>
      <div className="bar" style={{ ['--from' as string]: '#ffc93c', ['--to' as string]: '#ff8a3d' }}>
        <i ref={fillRef} />
      </div>
      <p className="stat-label mt-2 normal-case tracking-normal">
        +{GAME_FACTS.energy.regenPerSec} в секунду · один тап — одна единица
      </p>
    </div>
  );
}

const MAX_FLOATS = 28;

/**
 * Слой тапов: ловит касания по экрану у станции игры и спрашивает сцену, попал ли палец в кота.
 * Мышь — сразу по нажатию; касание — по отпусканию без сдвига (свайп листает страницу, а не тапает).
 */
function TapLayer() {
  const active = useAtStation(1);
  const touches = useRef(new Map<number, { x: number; y: number; t: number }>());
  const floats = useRef(0);

  const reward = (x: number, y: number) => {
    const api = sceneApi.get();
    const turbo = isTurbo();
    if (!api?.tap(x, y, turbo)) return;
    const value = demoTap();
    if (floats.current >= MAX_FLOATS) return;
    const el = document.createElement('div');
    el.className = 'float-reward';
    el.dataset.turbo = String(turbo);
    el.textContent = value === null ? 'Нет энергии' : `+${value}`;
    if (value === null) el.style.fontSize = '16px';
    document.body.appendChild(el);
    floats.current++;
    const dx = (Math.random() - 0.5) * 40;
    const anim = el.animate(
      [
        { transform: `translate(${x - 20}px, ${y - 24}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x - 20 + dx * 0.3}px, ${y - 54}px) scale(1.08)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${x - 20 + dx}px, ${y - 150}px) scale(0.92)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    anim.onfinish = () => {
      el.remove();
      floats.current--;
    };
  };

  return (
    <div
      className="tap-layer"
      style={{ display: active ? 'block' : 'none' }}
      aria-hidden
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') {
          if (e.button === 0) reward(e.clientX, e.clientY);
          return;
        }
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      }}
      onPointerUp={(e) => {
        const start = touches.current.get(e.pointerId);
        touches.current.delete(e.pointerId);
        if (!start) return;
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved < 12 && performance.now() - start.t < 450) reward(e.clientX, e.clientY);
      }}
      onPointerCancel={(e) => touches.current.delete(e.pointerId)}
    />
  );
}

/** «Тапай по коту» под котом, пока не было ни одного тапа. */
function TapHint() {
  const taps = useDemo((s) => s.taps);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (taps > 0) return;
    return onTick((v) => {
      const el = ref.current;
      if (!el) return;
      const near = nearness(v.pos, 1);
      const rect = near > 0.05 ? sceneApi.get()?.catRect() : null;
      if (!rect) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = String(Math.max(0, near * 1.6 - 0.6));
      el.style.left = `${rect.x + rect.width / 2}px`;
      el.style.top = `${rect.y + rect.height * 0.5}px`;
    });
  }, [taps]);
  if (taps > 0) return null;
  return (
    <div ref={ref} className="tap-hint" style={{ opacity: 0 }}>
      Тапай по коту
    </div>
  );
}
