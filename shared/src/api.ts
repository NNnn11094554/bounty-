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
  /** до какого момента действует Turbo (мс), null — не активен */
  turboUntil: number | null;
  totalTaps: number;
  boosts: BoostsState;
  /** время сервера, на которое рассчитано состояние (мс) */
  serverTime: number;
  /** следующий сброс ежедневных активностей (мс) */
  nextResetAt: number;
}

export interface OfflineIncome {
  earned: number;
  /** сколько игрока не было, сек */
  seconds: number;
  /** за сколько секунд начислен доход (не больше лимита накопления) */
  creditedSeconds: number;
}

export interface AuthResponse {
  state: PlayerState;
  config: GameConfig;
  offline: OfflineIncome | null;
  isNew: boolean;
}

export type StateResponse = { state: PlayerState };

export interface TapRequest {
  seq: number;
  taps: number;
  clientTime?: number;
}

export interface TapResponse {
  state: PlayerState;
  /** сколько тапов из пачки засчитано */
  accepted: number;
  /** пачка с таким номером уже обработана — ничего не начислено */
  duplicate: boolean;
}

export interface LeagueInfo {
  level: number;
  id: string;
  name: string;
  threshold: number;
  /** HEX-цвет или 'rainbow' для Lord */
  color: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  photoUrl: string | null;
  totalEarned: number;
  isPremium: boolean;
  isMe: boolean;
}

export interface LeaderboardResponse {
  level: number;
  /** топ-100 лиги по всего заработанному */
  players: LeaderboardEntry[];
  /** сколько всего игроков в лиге */
  total: number;
  /** моё место (null — я не в этой лиге) */
  me: { rank: number | null; totalEarned: number; leagueLevel: number };
  /** когда собран рейтинг (обновляется раз в минуту) */
  updatedAt: number;
}

export interface GameConfig {
  leagues: LeagueInfo[];
  tap: { syncIntervalMs: number; maxPerSecond: number };
  passive: { maxOfflineHours: number };
  turbo: { durationSec: number; multiplier: number };
  dailyResetUtcHour: number;
}

export type BoostType = 'full-energy' | 'turbo' | 'multitap' | 'energy-limit';

export interface PaidBoostState {
  level: number;
  /** уровень, который будет куплен; null — максимум */
  nextLevel: number | null;
  price: number | null;
  maxLevel: number;
}

export interface BoostsState {
  fullEnergy: { left: number; perDay: number; cooldownUntil: number | null; cooldownSec: number };
  turbo: {
    left: number;
    perDay: number;
    activeUntil: number | null;
    durationSec: number;
    multiplier: number;
  };
  multitap: PaidBoostState;
  energyLimit: PaidBoostState & { perLevel: number };
}
