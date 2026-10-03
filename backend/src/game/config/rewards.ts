/**
 * Награды за ежедневные активности. Меняйте числа здесь — сервер и клиент возьмут их отсюда.
 */
export const REWARDS = {
  /** ежедневная награда по дням серии; после 10-го дня цикл начинается заново */
  daily: [500, 1_000, 2_000, 3_500, 5_000, 7_500, 10_000, 15_000, 25_000, 50_000],
  /** все 3 карточки комбо дня улучшены за игровой день: часы дохода игрока, но не меньше минимума */
  combo: { hours: 3, min: 50_000 },
  /** шифр дня разгадан: час дохода игрока, но не меньше минимума */
  cipher: { hours: 1, min: 10_000 },
} as const;

/** Ежедневная награда за день серии streakDay (1…; цикл по REWARDS.daily). */
export function dailyReward(streakDay: number, _profitPerHour: number): number {
  const cycle = REWARDS.daily.length;
  return REWARDS.daily[(Math.max(1, streakDay) - 1) % cycle]!;
}

const scaled = (r: { hours: number; min: number }, profitPerHour: number) =>
  Math.max(r.min, Math.round((profitPerHour * r.hours) / 1000) * 1000);

/** Награда за комбо дня: растёт вместе с доходом, а не фиксированная сумма — не ломает начало игры. */
export function comboReward(profitPerHour: number): number {
  return scaled(REWARDS.combo, profitPerHour);
}

/** Награда за шифр дня (как и комбо — от дохода в час). */
export function cipherReward(profitPerHour: number): number {
  return scaled(REWARDS.cipher, profitPerHour);
}

/**
 * Рефералы: бонус обоим за нового друга (за друга с Telegram Premium — больше)
 * и бонус пригласившему, когда друг достигает лиги (за Premium-друга — ×premiumMultiplier).
 */
export const REFERRAL = {
  regular: 5_000,
  premium: 25_000,
  premiumMultiplier: 2,
  /** уровень лиги → бонус пригласившему */
  leagues: {
    1: 20_000,
    2: 30_000,
    3: 40_000,
    4: 60_000,
    5: 95_000,
    6: 195_000,
    7: 400_000,
    8: 800_000,
    9: 2_000_000,
  } as Readonly<Record<number, number>>,
} as const;

/** Комбо дня выбирается из карточек не дороже этого (первый уровень), чтобы его можно было собрать. */
export const COMBO_MAX_BASE_COST = 300_000;
