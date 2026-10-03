/** Контракт API админ-панели (/api/admin/*, доступ — только ADMIN_TELEGRAM_IDS). */
import type { CardCategory, CardRarity } from './cards.js';

export interface AdminDayPoint {
  dayKey: string;
  /** игроков, заходивших в этот игровой день */
  active: number;
  /** новых игроков */
  registered: number;
}

export interface AdminStats {
  players: number;
  newToday: number;
  dau: number;
  wau: number;
  mau: number;
  /** удержание когорт: доля вернувшихся на N-й день (0..1), null — когорта пуста */
  retention: { d1: number | null; d7: number | null; d30: number | null };
  /** монеты на руках и всего заработано за всё время */
  coins: { balance: number; earned: number };
  banned: number;
  suspicious: number;
  pendingNotifications: number;
  /** магазин: звёзды Telegram за оплаченные (не возвращённые) покупки — всего и за игровой день */
  shop: { starsTotal: number; starsToday: number; purchases: number };
  /** последние 14 игровых дней, по возрастанию */
  days: AdminDayPoint[];
  topReferrers: Array<{ id: number; name: string; username: string | null; friends: number }>;
  generatedAt: number;
}

export type AdminCardCondition =
  | { type: 'card'; cardId: string; level: number }
  | { type: 'friends'; count: number }
  | { type: 'task'; taskId: string }
  | { type: 'league'; level: number };

export interface AdminCardInput {
  category: CardCategory;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  icon: string;
  rarity: CardRarity;
  /** цена открытия в Telegram Stars; null — открывается за монеты */
  starsPrice: number | null;
  baseCost: number;
  baseProfit: number;
  costMultiplier: number;
  profitMultiplier: number;
  maxLevel: number;
  cooldownSec: number;
  condition: AdminCardCondition | null;
  isLimited: boolean;
  /** мс; для лимитированных — окно продажи (пусто — автоматическая ротация) */
  availableFrom: number | null;
  availableUntil: number | null;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminCard extends AdminCardInput {
  id: string;
  /** сколько игроков купили хотя бы 1 уровень */
  owners: number;
}

export interface CardLevelPreview {
  level: number;
  cost: number;
  /** прирост прибыли в час от этого уровня */
  profit: number;
  /** прибыль карточки в час на этом уровне */
  totalProfit: number;
  /** окупаемость уровня, часов */
  paybackHours: number;
}

export interface CardPreviewResponse {
  levels: CardLevelPreview[];
  /** нарушения правил экономики (как в npm run balance-check) */
  warnings: string[];
}

export interface AdminPlayerRow {
  id: number;
  telegramId: string;
  name: string;
  username: string | null;
  balance: number;
  totalEarned: number;
  profitPerHour: number;
  leagueLevel: number;
  suspiciousScore: number;
  isBanned: boolean;
  createdAt: number;
  lastSeenAt: number;
}

export interface AdminTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  /** сколько операций в строке (тапы и пассивный доход агрегируются по часу) */
  count: number;
  meta: unknown;
  createdAt: number;
}

export interface AdminPurchase {
  id: number;
  productId: string;
  stars: number;
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  createdAt: number;
  paidAt: number | null;
}

export interface AdminPlayerDetails extends AdminPlayerRow {
  lastName: string | null;
  languageCode: string;
  isPremium: boolean;
  banReason: string | null;
  totalTaps: number;
  multitapLevel: number;
  energyLimitLevel: number;
  friends: number;
  referrer: { id: number; name: string } | null;
  walletAddress: string | null;
  achievements: number;
  /** покупки в магазине за Stars (последние 20) */
  purchases: AdminPurchase[];
  transactions: AdminTransaction[];
  /** курсор для следующей страницы журнала */
  nextBefore: string | null;
}

export type BroadcastStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'DONE' | 'CANCELLED';

export interface AdminBroadcast {
  id: number;
  text: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  status: BroadcastStatus;
  total: number;
  sent: number;
  failed: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface AdminBroadcastInput {
  text: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
}

export interface AdminSettings {
  maintenance: { enabled: boolean; message: string };
  minClientVersion: string;
  happyHour: {
    auto: boolean;
    override: { startsAt: string; endsAt: string; multiplier: number } | null;
  };
  goldenCoin: { enabled: boolean };
  /** ближайший счастливый час с учётом настроек */
  nextHappyHour: { startsAt: number; endsAt: number; multiplier: number } | null;
}

export interface AdminDailyDay {
  dayKey: string;
  combo: { cardIds: string[]; source: string };
  cipher: { word: string; hintRu: string; hintEn: string; source: string };
}
