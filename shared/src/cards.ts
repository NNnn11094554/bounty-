/**
 * Карточки: категории, типы ответа API и каталог иконок.
 * Иконка карточки — строка "glyph/badge/palette": рисунок, значок в углу и градиент фона.
 * Бэкенд хранит строку, фронтенд рисует её (frontend/src/components/cardIcons.tsx).
 */
import type { PlayerState } from './api.js';
import type { ComboUpdate } from './daily.js';

export const CARD_CATEGORIES = ['MARKETS', 'PR_TEAM', 'LEGAL', 'SPECIALS'] as const;
export type CardCategory = (typeof CARD_CATEGORIES)[number];

export interface Localized {
  ru: string;
  en: string;
}

export const CARD_GLYPHS = [
  'candles',
  'chart_line',
  'coins',
  'handshake',
  'bars',
  'rocket',
  'chip',
  'gamepad',
  'scales',
  'people',
  'robot',
  'palette',
  'bank',
  'pie',
  'briefcase',
  'bolt',
  'drop',
  'crystal_ball',
  'server',
  'shield',
  'globe',
  'bridge',
  'cat_head',
  'building',
  'chain',
  'skyscraper',
  'headset',
  'book',
  'smiley',
  'mascot',
  'newspaper',
  'video',
  'chat',
  'mic',
  'magnifier',
  'ticket',
  'camera',
  'tv',
  'billboard',
  'laptop',
  'calculator',
  'medal',
  'stage',
  'heart',
  'clapper',
  'plane',
  'stadium',
  'satellite',
  'graduation',
  'calendar',
  'id_card',
  'document',
  'police_badge',
  'scroll',
  'stamp',
  'percent',
  'code',
  'lock',
  'gavel',
  'vault',
  'wallet',
  'bug',
  'box',
  'umbrella',
  'flag',
  'crown',
  'character',
  'laser',
  'yarn',
  'fish',
  'leaf',
  'moon',
  'post',
  'aquarium',
  'window',
  'can',
  'mouse',
  'cup',
  'medkit',
  'bell',
  'milk',
  'sun',
  'gear',
  'lucky_cat',
  'clock',
  'chest',
  'dragon',
  'bowl',
  'whiskers',
  'castle',
  'pumpkin',
  'tree',
  'envelope',
  'flower',
  'snowflake',
  'cake',
  'bull',
  'gift',
  'mooncake',
  'mask',
  'fireworks',
  'torch',
  'bag',
  'trophy',
  'eye',
  'megaphone',
] as const;
export type CardGlyph = (typeof CARD_GLYPHS)[number];

/** Значки-пиктограммы (кружок в углу) */
export const CARD_ICON_BADGES = [
  'none',
  'up',
  'plus',
  'check',
  'star',
  'heart',
  'coin',
  'crown',
  'globe',
  'chat',
  'lock',
  'clock',
  'fire',
  'paw',
  'sparkle',
  'trophy',
  'eye',
  'key',
  'moon',
  'sun',
  'snow',
  'bolt',
  'people',
  'music',
  'play',
  'pen',
  'zzz',
  'diamond',
  'spiral',
  'bubble',
  'nine',
  'percent',
  'x2',
] as const;
/** Значки-надписи (плашка в углу) */
export const CARD_TEXT_BADGES = [
  'P2P',
  'x10',
  'x20',
  'MEME',
  'DeFi',
  'AI',
  'NFT',
  'VIP',
  'PRO',
  'LIVE',
  'SEO',
  'TV',
  '247',
  'KYC',
  'AML',
  'TM',
  'EU',
  'AS',
  'NA',
  'AF',
  'LA',
  'OC',
  'DAO',
  'API',
] as const;
export type CardBadge = (typeof CARD_ICON_BADGES)[number] | (typeof CARD_TEXT_BADGES)[number];
export type CardIconBadge = (typeof CARD_ICON_BADGES)[number];
export type CardTextBadge = (typeof CARD_TEXT_BADGES)[number];
/** Надпись на плашке, если она отличается от имени значка ("/" — разделитель в строке иконки). */
export const CARD_BADGE_LABELS: Partial<Record<CardTextBadge, string>> = { '247': '24/7' };
export function isTextBadge(badge: CardBadge): badge is CardTextBadge {
  return (CARD_TEXT_BADGES as readonly string[]).includes(badge);
}

export const CARD_PALETTES = [
  ['#ffd75e', '#ff9f1c'], // 0 золото
  ['#ff8a3d', '#ff4f6d'], // 1 коралл
  ['#a66bff', '#6a4cff'], // 2 фиолет
  ['#2ed3c6', '#1e8fd6'], // 3 бирюза
  ['#4ade80', '#15924a'], // 4 зелень
  ['#4f9dff', '#2a5bd7'], // 5 синий
  ['#ff7ac0', '#d63aa0'], // 6 розовый
  ['#7ce9df', '#21b38a'], // 7 мята
  ['#ffb05e', '#f0632b'], // 8 апельсин
  ['#7b5cff', '#3b2bb0'], // 9 индиго
  ['#8aa0c8', '#4a5a7a'], // 10 сталь
  ['#ff5f6d', '#b3243b'], // 11 рубин
] as const;

export interface CardIconSpec {
  glyph: CardGlyph;
  badge: CardBadge;
  palette: number;
}

export function parseCardIcon(icon: string): CardIconSpec {
  const [glyph, badge = 'none', palette = '0'] = icon.split('/');
  return {
    glyph: (CARD_GLYPHS as readonly string[]).includes(glyph ?? '') ? (glyph as CardGlyph) : 'coins',
    badge: ([...CARD_ICON_BADGES, ...CARD_TEXT_BADGES] as readonly string[]).includes(badge)
      ? (badge as CardBadge)
      : 'none',
    palette: Math.abs(Number.parseInt(palette, 10) || 0) % CARD_PALETTES.length,
  };
}

export type CardLock =
  | { type: 'card'; cardId: string; level: number; currentLevel: number; name: Localized }
  | { type: 'friends'; count: number; current: number }
  | { type: 'task'; taskId: string; title: Localized | null }
  | { type: 'league'; level: number; name: string };

export interface CardView {
  id: string;
  category: CardCategory;
  name: Localized;
  description: Localized;
  icon: string;
  level: number;
  maxLevel: number;
  /** суммарная прибыль карточки в час на текущем уровне */
  profitPerHour: number;
  /** прирост прибыли в час за следующий уровень; null — максимум */
  nextProfit: number | null;
  /** цена следующего уровня; null — максимум */
  nextPrice: number | null;
  /** до какого момента карточка на кулдауне (мс) */
  cooldownUntil: number | null;
  cooldownSec: number;
  /** что нужно для открытия; null — открыта */
  lock: CardLock | null;
  /** можно ли улучшать сейчас: карточка в продаже и (для лимитированных) идёт окно доступности */
  available: boolean;
  /**
   * лимитированная карточка: until — конец текущего окна (мс),
   * nextFrom — начало следующего окна, если сейчас она недоступна (null — больше не вернётся)
   */
  limited: { until: number | null; nextFrom: number | null } | null;
  sortOrder: number;
}

export interface CardsResponse {
  cards: CardView[];
  serverTime: number;
}

export interface CardUpgradeResponse {
  state: PlayerState;
  /** карточка оказалась в комбо дня */
  combo: ComboUpdate | null;
  /** улучшенная карточка и карточки, условие которых зависело от неё */
  cards: CardView[];
  /** прирост прибыли в час от покупки */
  profitDelta: number;
}
