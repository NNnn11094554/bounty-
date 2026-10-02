import type { User } from '@prisma/client';
import { REWARDS } from './config/rewards.js';
import { dayKey, previousDayKey } from './dayKey.js';

export interface DailyRewardStatus {
  /** день цикла: полученный сегодня или тот, что можно забрать (1..10) */
  day: number;
  claimedToday: boolean;
  /** игрок пропустил день — следующая награда снова за День 1 */
  streakBroken: boolean;
  /** дней подряд с учётом сегодняшнего, если уже забрано */
  streak: number;
  reward: number;
  dayKey: string;
}

/** Состояние ежедневной награды на момент now (сброс — в DAILY_RESET_UTC_HOUR по UTC). */
export function dailyRewardStatus(
  user: Pick<User, 'dailyRewardDay' | 'dailyRewardDayKey' | 'dailyStreak'>,
  now: Date,
): DailyRewardStatus {
  const today = dayKey(now);
  const cycle = REWARDS.daily.length;
  if (user.dailyRewardDayKey === today) {
    const day = Math.min(Math.max(user.dailyRewardDay, 1), cycle);
    return {
      day,
      claimedToday: true,
      streakBroken: false,
      streak: user.dailyStreak,
      reward: REWARDS.daily[day - 1]!,
      dayKey: today,
    };
  }
  const continues = user.dailyRewardDayKey !== null && user.dailyRewardDayKey === previousDayKey(today);
  const day = continues ? (user.dailyRewardDay % cycle) + 1 : 1;
  return {
    day,
    claimedToday: false,
    streakBroken: !continues && user.dailyRewardDayKey !== null,
    streak: continues ? user.dailyStreak : 0,
    reward: REWARDS.daily[day - 1]!,
    dayKey: today,
  };
}
