/**
 * Основные игровые числа. Меняйте здесь — сервер пересчитает всё сам.
 * Карточки — cards.ts, лиги — leagues.ts, награды — rewards.ts.
 */
export const GAME = {
  energy: {
    /** максимум энергии = base + perLevel × (уровень Energy limit − 1) */
    base: 5000,
    perLevel: 500,
    /** восстановление, ед/сек */
    regenPerSec: 3,
  },
  tap: {
    /** больше 20 тапов/сек с прошлой синхронизации — обрезаем и повышаем suspiciousScore */
    maxPerSecond: 20,
    /** допуск на первую пачку и сетевые задержки */
    burstAllowance: 20,
    /** окно накопления тапов: после долгой паузы засчитывается не больше maxPerSecond × maxWindowSec */
    maxWindowSec: 60,
    /** клиент отправляет пачку раз в столько миллисекунд */
    syncIntervalMs: 2500,
  },
  turbo: {
    /** на столько секунд тап ×multiplier без траты энергии */
    durationSec: 60,
    multiplier: 5,
  },
  passive: {
    /** доход карточек копится максимум столько часов без входа */
    maxOfflineHours: 3,
    /** модалка «Пока вас не было…» после отсутствия дольше, сек */
    offlineModalMinSec: 60,
  },
} as const;

export function maxEnergy(energyLimitLevel: number): number {
  return GAME.energy.base + GAME.energy.perLevel * Math.max(0, energyLimitLevel - 1);
}

export function tapValue(multitapLevel: number): number {
  return Math.max(1, multitapLevel);
}
