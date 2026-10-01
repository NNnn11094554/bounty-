import type { User } from '@prisma/client';
import { BOOSTS } from './config/boosts.js';
import { dayKey } from './dayKey.js';

/** Счётчики бесплатных бустов на текущий игровой день (после сброса — нули). */
export function dailyBoostUsage(
  user: Pick<User, 'boostsDayKey' | 'fullEnergyUsedToday' | 'turboUsedToday'>,
  now: Date,
) {
  const today = dayKey(now);
  const sameDay = user.boostsDayKey === today;
  return {
    dayKey: today,
    fullEnergyUsed: sameDay ? user.fullEnergyUsedToday : 0,
    turboUsed: sameDay ? user.turboUsedToday : 0,
  };
}

export function fullEnergyCooldownUntil(lastAt: Date | null): Date | null {
  if (!lastAt) return null;
  return new Date(lastAt.getTime() + BOOSTS.fullEnergy.cooldownSec * 1000);
}
