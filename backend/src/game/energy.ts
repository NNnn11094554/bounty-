import { GAME, maxEnergy } from './config/game.js';

export interface EnergySnapshot {
  energy: number;
  updatedAt: Date;
  max: number;
}

/**
 * Энергия «сейчас»: прошлое значение + восстановление за прошедшее время, не больше максимума.
 * Возвращает и момент, на который рассчитано значение, без потери дробных долей восстановления.
 */
export function currentEnergy(
  stored: { energy: number; energyUpdatedAt: Date; energyLimitLevel: number },
  now: Date,
): EnergySnapshot {
  const max = maxEnergy(stored.energyLimitLevel);
  const start = Math.min(stored.energy, max);
  const elapsedMs = Math.max(0, now.getTime() - stored.energyUpdatedAt.getTime());
  const regen = GAME.energy.regenPerSec;
  const gained = Math.floor((elapsedMs * regen) / 1000);
  if (start + gained >= max) return { energy: max, updatedAt: now, max };
  // переносим «недовосстановленный» остаток: двигаем отметку времени ровно на столько, сколько ушло на gained
  const consumedMs = Math.floor((gained * 1000) / regen);
  return { energy: start + gained, updatedAt: new Date(stored.energyUpdatedAt.getTime() + consumedMs), max };
}
