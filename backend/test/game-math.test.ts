import { describe, expect, it } from 'vitest';
import { maxEnergy, tapValue } from '../src/game/config/game.js';
import { leagueForTotal } from '../src/game/config/leagues.js';
import { dayKey, nextResetAt, previousDayKey } from '../src/game/dayKey.js';
import { currentEnergy } from '../src/game/energy.js';
import { accruePassive } from '../src/game/passive.js';
import { evaluateTaps, tapAllowance } from '../src/game/tap.js';

const base = {
  energy: 1000,
  tapValue: 1,
  sinceLastSyncMs: 2500,
  turboActive: false,
  turboMultiplier: 5,
  eventMultiplier: 1,
};

describe('energy', () => {
  it('max energy grows by 500 per Energy limit level', () => {
    expect(maxEnergy(1)).toBe(5000);
    expect(maxEnergy(2)).toBe(5500);
    expect(maxEnergy(16)).toBe(12500);
    expect(tapValue(1)).toBe(1);
    expect(tapValue(17)).toBe(17);
  });

  it('regenerates 3 per second up to the max and keeps fractional progress', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const e1 = currentEnergy(
      { energy: 100, energyUpdatedAt: t0, energyLimitLevel: 1 },
      new Date(t0.getTime() + 10_000),
    );
    expect(e1.energy).toBe(130);
    // 0.5 с → 1 единица (1.5 округляется вниз), остаток 0.5 с переносится
    const e2 = currentEnergy(
      { energy: 100, energyUpdatedAt: t0, energyLimitLevel: 1 },
      new Date(t0.getTime() + 500),
    );
    expect(e2.energy).toBe(101);
    const e3 = currentEnergy(
      { energy: 101, energyUpdatedAt: e2.updatedAt, energyLimitLevel: 1 },
      new Date(t0.getTime() + 1000),
    );
    expect(e3.energy).toBe(103); // за целую секунду ровно 3 единицы, без потерь
    const full = currentEnergy(
      { energy: 4990, energyUpdatedAt: t0, energyLimitLevel: 1 },
      new Date(t0.getTime() + 60_000),
    );
    expect(full.energy).toBe(5000);
  });
});

describe('tap antifraud', () => {
  it('credits normal taps', () => {
    expect(evaluateTaps({ ...base, requested: 30 })).toMatchObject({
      accepted: 30,
      earned: 30,
      energySpent: 30,
      suspicious: false,
    });
  });

  it('caps taps by rate (20/s) and flags', () => {
    const allowance = tapAllowance(2500);
    expect(allowance).toBe(70);
    const r = evaluateTaps({ ...base, requested: 500 });
    expect(r.accepted).toBe(70);
    expect(r.suspicious).toBe(true);
    expect(r.limitedBy).toBe('rate');
  });

  it('caps the accumulation window', () => {
    expect(tapAllowance(10 * 60_000)).toBe(20 * 60 + 20);
    expect(tapAllowance(-5000)).toBe(20);
  });

  it('caps taps by energy (floor(energy / tapValue))', () => {
    const r = evaluateTaps({ ...base, requested: 50, energy: 95, tapValue: 10 });
    expect(r).toMatchObject({
      accepted: 9,
      earned: 90,
      energySpent: 90,
      limitedBy: 'energy',
      suspicious: false,
    });
    expect(evaluateTaps({ ...base, requested: 10, energy: 0 }).accepted).toBe(0);
  });

  it('turbo multiplies and spends no energy', () => {
    const r = evaluateTaps({ ...base, requested: 40, energy: 0, tapValue: 2, turboActive: true });
    expect(r).toMatchObject({ accepted: 40, earned: 400, energySpent: 0 });
  });

  it('ignores negative and fractional input', () => {
    expect(evaluateTaps({ ...base, requested: -100 }).accepted).toBe(0);
    expect(evaluateTaps({ ...base, requested: 5.9 }).accepted).toBe(5);
  });
});

describe('passive income', () => {
  const t0 = new Date('2026-01-01T00:00:00Z');
  it('pays profitPerHour proportionally', () => {
    const r = accruePassive(3600n, t0, new Date(t0.getTime() + 60_000));
    expect(r.amount.toNumber()).toBe(60);
    expect(r.creditedSeconds).toBe(60);
  });
  it('is capped at 3 hours', () => {
    const r = accruePassive(1000n, t0, new Date(t0.getTime() + 10 * 3_600_000));
    expect(r.amount.toNumber()).toBe(3000);
    expect(r.creditedSeconds).toBe(3 * 3600);
    expect(r.elapsedSeconds).toBe(10 * 3600);
  });
  it('keeps fractions (no loss on frequent syncs)', () => {
    const r = accruePassive(100n, t0, new Date(t0.getTime() + 2500));
    expect(r.amount.toFixed(6)).toBe('0.069444');
  });
  it('handles clock going backwards', () => {
    expect(accruePassive(1000n, t0, new Date(t0.getTime() - 5000)).amount.toNumber()).toBe(0);
  });
});

describe('leagues and day keys', () => {
  it('maps total earned to league', () => {
    expect(leagueForTotal(0)).toBe(0);
    expect(leagueForTotal(4_999)).toBe(0);
    expect(leagueForTotal(5_000)).toBe(1);
    expect(leagueForTotal(1_000_000)).toBe(4);
    expect(leagueForTotal(5_000_000_000)).toBe(9);
  });
  it('resets the game day at 16:00 UTC', () => {
    expect(dayKey(new Date('2026-10-01T15:59:59Z'), 16)).toBe('2026-09-30');
    expect(dayKey(new Date('2026-10-01T16:00:00Z'), 16)).toBe('2026-10-01');
    expect(nextResetAt(new Date('2026-10-01T10:00:00Z'), 16).toISOString()).toBe('2026-10-01T16:00:00.000Z');
    expect(nextResetAt(new Date('2026-10-01T17:00:00Z'), 16).toISOString()).toBe('2026-10-02T16:00:00.000Z');
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
  });
});
