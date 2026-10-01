import { GAME } from './config/game.js';

export interface TapInput {
  /** сколько тапов прислал клиент */
  requested: number;
  /** энергия на момент обработки (с учётом восстановления) */
  energy: number;
  tapValue: number;
  /** время с прошлой принятой пачки, мс */
  sinceLastSyncMs: number;
  turboActive: boolean;
  turboMultiplier: number;
  /** глобальный множитель («счастливый час»), 1 — обычный режим */
  eventMultiplier: number;
}

export interface TapResult {
  accepted: number;
  earned: number;
  energySpent: number;
  /** запрос превысил разумную частоту — повод для suspiciousScore */
  suspicious: boolean;
  limitedBy: 'none' | 'rate' | 'energy';
}

/** Сколько тапов можно было физически сделать с прошлой синхронизации. */
export function tapAllowance(sinceLastSyncMs: number): number {
  const windowSec = Math.min(GAME.tap.maxWindowSec, Math.max(0, sinceLastSyncMs) / 1000);
  return Math.floor(GAME.tap.maxPerSecond * windowSec) + GAME.tap.burstAllowance;
}

/**
 * Антифрод тапов — чистая функция, всё считается на сервере:
 *  - не больше maxPerSecond тапов в секунду с прошлой синхронизации (иначе обрезка и пометка);
 *  - не больше, чем позволяет энергия: floor(энергия / прибыль за тап) — кроме Turbo;
 *  - монеты = принятые тапы × прибыль за тап × множители.
 */
export function evaluateTaps(input: TapInput): TapResult {
  const requested = Math.max(0, Math.floor(input.requested));
  const allowance = tapAllowance(input.sinceLastSyncMs);
  const rateCapped = Math.min(requested, allowance);
  const suspicious = requested > allowance;
  let accepted = rateCapped;
  let limitedBy: TapResult['limitedBy'] = suspicious ? 'rate' : 'none';
  let energySpent = 0;
  if (!input.turboActive) {
    const byEnergy = Math.floor(Math.max(0, input.energy) / input.tapValue);
    if (byEnergy < accepted) {
      accepted = byEnergy;
      limitedBy = 'energy';
    }
    energySpent = accepted * input.tapValue;
  }
  const multiplier = (input.turboActive ? input.turboMultiplier : 1) * input.eventMultiplier;
  return { accepted, earned: accepted * input.tapValue * multiplier, energySpent, suspicious, limitedBy };
}
