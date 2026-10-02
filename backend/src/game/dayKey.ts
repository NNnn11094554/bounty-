import { env } from '../env.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Игровой день: сбрасывается ежедневно в DAILY_RESET_UTC_HOUR:00 UTC.
 * Ключ — дата начала игрового дня в UTC, "2026-10-01".
 */
export function dayKey(at: Date = new Date(), resetHour = env.DAILY_RESET_UTC_HOUR): string {
  return new Date(at.getTime() - resetHour * HOUR).toISOString().slice(0, 10);
}

export function previousDayKey(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - DAY).toISOString().slice(0, 10);
}

export function dayStart(key: string, resetHour = env.DAILY_RESET_UTC_HOUR): Date {
  return new Date(Date.parse(`${key}T00:00:00Z`) + resetHour * HOUR);
}

/** Момент следующего сброса ежедневных активностей. */
export function nextResetAt(at: Date = new Date(), resetHour = env.DAILY_RESET_UTC_HOUR): Date {
  return new Date(dayStart(dayKey(at, resetHour), resetHour).getTime() + DAY);
}

/** Ключ часа для агрегации журнала: "2026-10-01T13". */
export function hourBucket(at: Date = new Date()): string {
  return at.toISOString().slice(0, 13);
}
