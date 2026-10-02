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
  | 'FORBIDDEN'
  | 'NOT_COMPLETED'
  | 'UNAVAILABLE'
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

export interface DailyRewardState {
  /** день цикла: полученный сегодня или тот, что можно забрать (1..10) */
  day: number;
  claimedToday: boolean;
  /** игрок пропустил день — награда снова начнётся с Дня 1 */
  streakBroken: boolean;
  /** дней подряд */
  streak: number;
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
  /** до какого момента пассивный доход ×INCOME_BOOST_MULTIPLIER (покупка в магазине), null — нет */
  incomeBoostUntil: number | null;
  totalTaps: number;
  boosts: BoostsState;
  daily: DailyRewardState;
  achievements: {
    /** сколько получено */
    unlocked: number;
    total: number;
    /** полученные, но ещё не показанные игроку (всплывающее уведомление) */
    fresh: string[];
  };
  /** мини-события: ближайший (или идущий) счастливый час */
  events: { happyHour: HappyHourInfo | null };
  /** подключённый кошелёк TON (адрес в user-friendly формате) */
  wallet: { address: string; connectedAt: number } | null;
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
  /** игрок пришёл по приглашению — бонус уже начислен */
  referral: { inviterName: string; bonus: number } | null;
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
  /** после этой пачки по экрану пробежит золотая монета */
  goldenCoin: GoldenCoinEvent | null;
}

/** «Счастливый час»: ×multiplier к тапам с startsAt до endsAt (мс). */
export interface HappyHourInfo {
  startsAt: number;
  endsAt: number;
  multiplier: number;
}

/** Золотая монета: бежит по экрану с appearsAt до expiresAt (мс), поймать — +reward. */
export interface GoldenCoinEvent {
  id: string;
  appearsAt: number;
  expiresAt: number;
  reward: number;
}

export interface GoldenCoinClaimResponse {
  state: PlayerState;
  reward: number;
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

export interface FriendEntry {
  /** id приглашения (курсор для подгрузки) */
  id: number;
  name: string;
  photoUrl: string | null;
  isPremium: boolean;
  leagueLevel: number;
  balance: number;
  /** сколько получил я за этого друга */
  bonus: number;
  joinedAt: number;
}

export interface FriendsResponse {
  link: string;
  total: number;
  /** сколько всего получено за друзей */
  earned: number;
  friends: FriendEntry[];
  nextCursor: number | null;
  bonuses: {
    regular: number;
    premium: number;
    leagues: Array<{ level: number; regular: number; premium: number }>;
  };
}

export interface TonProofPayloadResponse {
  payload: string;
  expiresAt: number;
}

/** Данные TON Connect после подключения кошелька с ton_proof. */
export interface WalletConnectRequest {
  address: string;
  network: string;
  publicKey: string;
  proof: {
    timestamp: number;
    domain: { lengthBytes: number; value: string };
    signature: string;
    payload: string;
    stateInit: string;
  };
}

export interface GameConfig {
  leagues: LeagueInfo[];
  tap: { syncIntervalMs: number; maxPerSecond: number };
  passive: { maxOfflineHours: number };
  turbo: { durationSec: number; multiplier: number };
  dailyResetUtcHour: number;
  /** награды ежедневки по дням цикла */
  dailyRewards: number[];
  /** бонус за приглашённого друга (обоим) */
  referral: { regular: number; premium: number };
}

export interface DailyClaimResponse {
  state: PlayerState;
  reward: number;
  day: number;
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
