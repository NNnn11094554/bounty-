import type { User } from '@prisma/client';
import { DEFAULT_SETTINGS, type PlayerSettings, type PlayerState } from '@meowgul/shared';
import { env } from '../env.js';
import { GAME, tapValue } from '../game/config/game.js';
import { nextResetAt } from '../game/dayKey.js';
import { currentEnergy } from '../game/energy.js';
import { toCoins } from '../lib/money.js';

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
    totalTaps: Number(user.totalTaps),
    serverTime: now.getTime(),
    nextResetAt: nextResetAt(now).getTime(),
  };
}
