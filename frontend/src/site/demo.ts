import { playerLevel, type LevelInfo } from '@meowgul/shared';
import { create } from 'zustand';
import { GAME_FACTS, LEAGUES } from './content';

/**
 * Демо игры на сайте: локальный игрок середины игры. Правила — как в игре (энергия, восстановление,
 * Turbo ×5 без траты энергии, пассивный доход), но ничего не уходит на сервер.
 */
const PROFIT_PER_HOUR = 36_000;
const TAP = 1;

const state = {
  balance: 1_240_000,
  energy: GAME_FACTS.energy.max as number,
  turboUntil: 0,
  last: 0,
};

const nowSec = () => performance.now() / 1000;

function advance(): number {
  const now = nowSec();
  if (!state.last) state.last = now;
  const dt = now - state.last;
  state.last = now;
  state.balance += (PROFIT_PER_HOUR / 3600) * dt;
  state.energy = Math.min(GAME_FACTS.energy.max, state.energy + GAME_FACTS.energy.regenPerSec * dt);
  return now;
}

export function leagueIndex(total: number): number {
  let i = 0;
  for (const [k, l] of LEAGUES.entries()) if (total >= l.threshold) i = k;
  return i;
}

interface DemoView {
  league: number;
  level: LevelInfo;
  turboLeft: number;
  fullLeft: number;
  turboActive: boolean;
  /** тапов за сессию (подсказка «тапай» исчезает после первого) */
  taps: number;
}

const snapshot = (): Pick<DemoView, 'league' | 'level'> => ({
  league: leagueIndex(state.balance),
  level: playerLevel(state.balance),
});

/** Редко меняющееся — для React (лига, уровень, заряды бустов). Частое (баланс, энергия) — через demo*. */
export const useDemo = create<DemoView>(() => ({
  ...snapshot(),
  turboLeft: GAME_FACTS.turbo.perDay,
  fullLeft: GAME_FACTS.fullEnergy.perDay,
  turboActive: false,
  taps: 0,
}));

export function demoBalance(): number {
  advance();
  return state.balance;
}

export function demoEnergy(): number {
  advance();
  return state.energy;
}

/** Сколько секунд Turbo осталось (0 — не активен). */
export function turboSeconds(): number {
  const left = state.turboUntil - nowSec();
  if (left <= 0 && useDemo.getState().turboActive) useDemo.setState({ turboActive: false });
  return Math.max(0, left);
}

/** Тап: награда или null (энергия кончилась). */
export function demoTap(): number | null {
  const now = advance();
  const turbo = now < state.turboUntil;
  if (!turbo && state.energy < TAP) return null;
  const reward = TAP * (turbo ? GAME_FACTS.turbo.multiplier : 1);
  if (!turbo) state.energy -= TAP;
  state.balance += reward;
  const prev = useDemo.getState();
  const next = snapshot();
  useDemo.setState({
    taps: prev.taps + 1,
    ...(next.league !== prev.league || next.level.level !== prev.level.level ? next : {}),
  });
  return reward;
}

export function startTurbo(): boolean {
  const s = useDemo.getState();
  if (s.turboLeft <= 0 || s.turboActive) return false;
  state.turboUntil = nowSec() + GAME_FACTS.turbo.seconds;
  useDemo.setState({ turboLeft: s.turboLeft - 1, turboActive: true });
  return true;
}

export function refillEnergy(): boolean {
  const s = useDemo.getState();
  if (s.fullLeft <= 0) return false;
  advance();
  state.energy = GAME_FACTS.energy.max;
  useDemo.setState({ fullLeft: s.fullLeft - 1 });
  return true;
}

export function isTurbo(): boolean {
  return nowSec() < state.turboUntil;
}

/** Начислить награду (ежедневная награда на сайте). */
export function demoAdd(amount: number): void {
  advance();
  state.balance += amount;
}
