import type { Locale } from './format.js';

/**
 * Контракт API между клиентом и сервером. Все игровые числа считает сервер;
 * денежные значения передаются как number (целые монеты, < 2^53).
 */

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'BANNED'
  | 'MAINTENANCE'
  | 'OUTDATED_CLIENT'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'COOLDOWN'
  | 'LOCKED'
  | 'LIMIT_REACHED'
  | 'ALREADY_DONE'
  | 'CONFLICT'
  | 'INTERNAL';

export interface HealthResponse {
  status: 'ok';
  version: string;
  time: string;
}

export interface PlayerSettings {
  /** null — по языку Telegram */
  language: Locale | null;
  sound: boolean;
  vibration: boolean;
  animations: 'full' | 'reduced';
  notifications: boolean;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  language: null,
  sound: true,
  vibration: true,
  animations: 'full',
  notifications: true,
};

export interface PlayerProfile {
  id: number;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: Locale;
  isPremium: boolean;
  isAdmin: boolean;
  hqId: string | null;
  onboardingDone: boolean;
  settings: PlayerSettings;
  tutorialsSeen: string[];
  createdAt: string;
}

export interface PlayerState {
  profile: PlayerProfile;
  /** целые монеты на момент serverTime */
  balance: number;
  totalEarned: number;
  profitPerHour: number;
  tapValue: number;
  energy: number;
  maxEnergy: number;
  energyRegenPerSec: number;
  multitapLevel: number;
  energyLimitLevel: number;
  leagueLevel: number;
  /** номер последней принятой пачки тапов */
  tapSeq: number;
  /** время сервера, на которое рассчитано состояние (мс) */
  serverTime: number;
  /** следующий сброс ежедневных активностей (мс) */
  nextResetAt: number;
}

export interface OfflineIncome {
  earned: number;
  seconds: number;
}

export interface AuthResponse {
  state: PlayerState;
  offline: OfflineIncome | null;
  isNew: boolean;
}

export type StateResponse = { state: PlayerState };
