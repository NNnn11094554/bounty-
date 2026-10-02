import type { User } from '@prisma/client';
import {
  VISIBLE_ACHIEVEMENTS,
  achievementById,
  DEFAULT_SETTINGS,
  type PlayerSettings,
  type PlayerState,
} from '@meowgul/shared';
import { env } from '../env.js';
import { dailyBoostUsage, fullEnergyCooldownUntil } from '../game/boosts.js';
import { BOOSTS, boostLevelPrice, type PaidBoost } from '../game/config/boosts.js';
import { GAME, tapValue } from '../game/config/game.js';
import { nextResetAt } from '../game/dayKey.js';
import { dailyRewardStatus } from '../game/daily.js';
import { currentEnergy } from '../game/energy.js';
import { toCoins } from '../lib/money.js';
import { nextHappyHour } from './events.js';
import { cachedAppSettings } from './settings.js';
import { friendlyAddress } from './tonProof.js';

export function parseSettings(raw: unknown): PlayerSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<PlayerSettings>;
  return {
    language: s.language === 'ru' || s.language === 'en' ? s.language : DEFAULT_SETTINGS.language,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    vibration: typeof s.vibration === 'boolean' ? s.vibration : DEFAULT_SETTINGS.vibration,
    animations: s.animations === 'reduced' ? 'reduced' : 'full',
    notifications: typeof s.notifications === 'boolean' ? s.notifications : DEFAULT_SETTINGS.notifications,
  };
}

export function isAdmin(user: Pick<User, 'telegramId'>): boolean {
  return env.adminIds.has(user.telegramId);
}

function paidBoost(boost: PaidBoost, level: number) {
  const next = level + 1;
  const max = BOOSTS[boost].maxLevel;
  return {
    level,
    nextLevel: next <= max ? next : null,
    price: next <= max ? boostLevelPrice(boost, next) : null,
    maxLevel: max,
  };
}

/** Полное состояние игрока для клиента. Все числа рассчитаны сервером на момент now. */
export function buildPlayerState(user: User, now: Date = new Date()): PlayerState {
  const energy = currentEnergy(user, now);
  return {
    profile: {
      id: user.id,
      telegramId: user.telegramId.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      languageCode: user.languageCode === 'ru' ? 'ru' : 'en',
      isPremium: user.isPremium,
      isAdmin: isAdmin(user),
      hqId: user.hqId,
      onboardingDone: user.onboardingDone,
      settings: parseSettings(user.settings),
      tutorialsSeen: user.tutorialsSeen,
      createdAt: user.createdAt.toISOString(),
    },
    balance: toCoins(user.balance),
    totalEarned: toCoins(user.totalEarned),
    profitPerHour: Number(user.profitPerHour),
    tapValue: tapValue(user.multitapLevel),
    energy: energy.energy,
    maxEnergy: energy.max,
    energyRegenPerSec: GAME.energy.regenPerSec,
    multitapLevel: user.multitapLevel,
    energyLimitLevel: user.energyLimitLevel,
    leagueLevel: user.leagueLevel,
    tapSeq: user.lastTapSeq,
    turboUntil: user.turboUntil && user.turboUntil > now ? user.turboUntil.getTime() : null,
    incomeBoostUntil:
      user.incomeBoostUntil && user.incomeBoostUntil > now ? user.incomeBoostUntil.getTime() : null,
    cosmetics: { skin: user.equippedSkinId, effect: user.equippedEffectId },
    totalTaps: Number(user.totalTaps),
    boosts: boostsState(user, now),
    daily: dailyState(user, now),
    events: { happyHour: nextHappyHour(cachedAppSettings(), now) },
    achievements: {
      // только видимые: достижение за кошелёк (если было) не даёт «61 из 60», пока кошелёк скрыт
      unlocked: user.achievementIds.filter((id) => VISIBLE_ACHIEVEMENTS.some((a) => a.id === id)).length,
      total: VISIBLE_ACHIEVEMENTS.length,
      fresh: user.newAchievementIds.filter((id) => achievementById(id)),
    },
    wallet:
      user.walletAddress && user.walletConnectedAt
        ? { address: friendlyAddress(user.walletAddress), connectedAt: user.walletConnectedAt.getTime() }
        : null,
    serverTime: now.getTime(),
    nextResetAt: nextResetAt(now).getTime(),
  };
}

function dailyState(user: User, now: Date) {
  const s = dailyRewardStatus(user, now);
  return { day: s.day, claimedToday: s.claimedToday, streakBroken: s.streakBroken, streak: s.streak };
}

function boostsState(user: User, now: Date) {
  const usage = dailyBoostUsage(user, now);
  const cooldown = fullEnergyCooldownUntil(user.fullEnergyLastAt);
  const turboActive = user.turboUntil && user.turboUntil > now ? user.turboUntil.getTime() : null;
  return {
    fullEnergy: {
      left: Math.max(0, BOOSTS.fullEnergy.perDay - usage.fullEnergyUsed),
      perDay: BOOSTS.fullEnergy.perDay,
      cooldownUntil: cooldown && cooldown > now ? cooldown.getTime() : null,
      cooldownSec: BOOSTS.fullEnergy.cooldownSec,
    },
    turbo: {
      left: Math.max(0, BOOSTS.turbo.perDay - usage.turboUsed),
      perDay: BOOSTS.turbo.perDay,
      activeUntil: turboActive,
      durationSec: GAME.turbo.durationSec,
      multiplier: GAME.turbo.multiplier,
    },
    multitap: paidBoost('multitap', user.multitapLevel),
    energyLimit: { ...paidBoost('energyLimit', user.energyLimitLevel), perLevel: GAME.energy.perLevel },
  };
}
