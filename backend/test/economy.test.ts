import { describe, expect, it } from 'vitest';
import { CARDS, cardLevelCost, cardLevelProfit } from '../src/game/config/cards.js';
import { GAME } from '../src/game/config/game.js';
import { LEAGUES } from '../src/game/config/leagues.js';
import { REWARDS, cipherReward, comboReward, dailyReward } from '../src/game/config/rewards.js';
import { NORMAL_PLAYER, simulate, type PlayerProfile } from '../src/game/economy/simulate.js';
import { accruePassive } from '../src/game/passive.js';

/**
 * Экономика под долгую игру: обычный активный игрок (4 захода в день, пропуск раз в неделю, шифр и комбо
 * не каждый день, друзья появляются постепенно) берёт ~80% общего прогресса за 6–7 месяцев, а 100% —
 * долгий эндгейм. Симуляция — на настоящем конфиге, тот же код, что в `npm run economy-sim`.
 */
describe('economy: long progression', () => {
  const DAYS = 760;
  const days = Array.from({ length: DAYS }, (_, i) => i + 1);
  const normal = simulate({ days: DAYS, snapshotDays: days });
  const at = (day: number) => normal[day - 1]!.progress.total;
  const reach = (share: number) => normal.find((s) => s.progress.total >= share)?.day ?? null;

  it('a few weeks is only the beginning, 3 months is far from the end', () => {
    expect(at(7)).toBeLessThan(0.22);
    expect(at(21)).toBeLessThan(0.4);
    expect(at(30)).toBeGreaterThan(0.2); // но развитие чувствуется сразу
    expect(at(90)).toBeGreaterThan(0.45);
    expect(at(90)).toBeLessThan(0.7);
  });

  it('~80% after 6–7 months of active play', () => {
    const day80 = reach(0.8);
    expect(day80).not.toBeNull();
    expect(day80!).toBeGreaterThanOrEqual(180);
    expect(day80!).toBeLessThanOrEqual(225);
  });

  it('the last 20% is a long end game: no 100% within two years', () => {
    expect(at(DAYS)).toBeLessThan(1);
    expect(at(DAYS)).toBeGreaterThan(0.9); // но и не стена: прогресс идёт
  });

  it('progress is non-linear: each stage is slower than the previous one', () => {
    const d20 = reach(0.2)!;
    const d50 = reach(0.5)!;
    const d70 = reach(0.7)!;
    const d80 = reach(0.8)!;
    // дней на каждые 10% прогресса растёт от этапа к этапу
    const pace = [d20 / 2, (d50 - d20) / 3, (d70 - d50) / 2, (d80 - d70) / 1];
    for (let i = 1; i < pace.length; i++) expect(pace[i]!).toBeGreaterThan(pace[i - 1]!);
  });

  it('there is always something to do: purchases stay within reach', () => {
    for (const day of [7, 30, 90, 180]) {
      const s = normal[day - 1]!;
      expect(s.nextBuyHours).toBeLessThan(72);
      expect(s.availableUpgrades).toBeGreaterThan(5);
    }
  });

  it('even a hardcore player (7 visits a day, never misses) does not reach 80% in 3 months', () => {
    const hardcore: PlayerProfile = {
      ...NORMAL_PLAYER,
      sessions: [7, 10, 13, 16, 19, 22, 24.5],
      missEveryNthDay: 0,
      cipherRate: 1,
      comboRate: 1,
      fullEnergyPerDay: 6,
    };
    const s = simulate({ days: 95, profile: hardcore, snapshotDays: [21, 90] });
    expect(s[0]!.progress.total).toBeLessThan(0.5);
    expect(s[1]!.progress.total).toBeLessThan(0.8);
  });
}, 180_000);

describe('economy: inflation sources', () => {
  it('combo and cipher pay hours of income, not a fixed jackpot', () => {
    expect(comboReward(0)).toBe(REWARDS.combo.min);
    expect(cipherReward(0)).toBe(REWARDS.cipher.min);
    expect(comboReward(1_000_000)).toBe(3_000_000);
    expect(cipherReward(1_000_000)).toBe(1_000_000);
  });

  it('daily streak rewards are a small bonus (whole 10-day cycle < 150 000)', () => {
    const cycle = REWARDS.daily.reduce((s, r) => s + r, 0);
    expect(cycle).toBeLessThan(150_000);
    expect(dailyReward(11, 0)).toBe(REWARDS.daily[0]);
  });

  it('offline income is capped at 3 hours', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const later = new Date(t0.getTime() + 10 * 3600_000);
    const { amount } = accruePassive(3600n, t0, later);
    expect(amount.toNumber()).toBe(3600 * GAME.passive.maxOfflineHours);
  });

  it('cards: no single level adds more than 2M/h; the first levels pay back in hours', () => {
    const cheap = CARDS.filter((c) => c.baseCost <= 1_000);
    for (const c of cheap) expect(cardLevelCost(c, 1) / cardLevelProfit(c, 1)).toBeLessThan(8);
    for (const c of CARDS) expect(cardLevelProfit(c, c.maxLevel)).toBeLessThanOrEqual(2_000_000);
  });

  it('leagues grow steadily: every next league needs at least ~3× more', () => {
    for (let i = 3; i < LEAGUES.length; i++)
      expect(LEAGUES[i]!.threshold / LEAGUES[i - 1]!.threshold).toBeGreaterThanOrEqual(2.9);
  });
});
