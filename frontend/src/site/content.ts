import {
  AIRDROP_REQUIREMENTS,
  MAX_LEVEL,
  START_BONUS,
  type AirdropRequirementId,
  type Rarity,
} from '@meowgul/shared';

/**
 * Сайт — одна 3D-сцена и поверх неё обычные секции страницы. У каждой секции — своя точка съёмки
 * в сцене (станция): прокрутка ведёт камеру от станции к станции, подвал — продолжение финала.
 */
export const SECTIONS = [
  'home',
  'project',
  'gameplay',
  'collection',
  'airdrop',
  'partners',
  'roadmap',
  'community',
] as const;
export type SectionId = (typeof SECTIONS)[number];
export const sectionIndex = (id: SectionId): number => SECTIONS.indexOf(id);

/** Пункты навигации — в порядке страницы (подписи — в словаре: nav.<id>). */
export const NAV = [
  'project',
  'gameplay',
  'collection',
  'airdrop',
  'roadmap',
  'community',
] as const satisfies readonly SectionId[];

/**
 * Ссылки сообщества. Telegram — бот игры; X и сообщество задаются при сборке (VITE_X_URL,
 * VITE_COMMUNITY_URL) — пока их нет, кнопка показывает «Soon» и никуда не ведёт.
 */
export const LINKS = {
  telegram: `https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'meowgul_game_bot'}`,
  x: import.meta.env.VITE_X_URL || null,
  community: import.meta.env.VITE_COMMUNITY_URL || null,
  /** куда ведёт «Стать партнёром»: контакт команды (VITE_PARTNER_URL), пока его нет — Telegram проекта */
  partner:
    import.meta.env.VITE_PARTNER_URL ||
    `https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'meowgul_game_bot'}`,
};

/**
 * Метрики для партнёров — ТОЛЬКО реальные данные. Пока значения нет (null), на сайте вместо числа написано
 * «По запросу». Заполнить: строка как есть, например users: '120K', retention: '38% D7'.
 */
export const PARTNER_METRICS: Record<'users' | 'community' | 'retention' | 'countries', string | null> = {
  users: null,
  community: null,
  retention: null,
  countries: null,
};

/**
 * Тексты сайта — в словарях (i18n/<язык>.ts); здесь только то, что от языка не зависит: порядок, состояния,
 * связи с котами и числа игры.
 */

/** Ступени редкости по порядку (цвет — как в игре, подписи — в словаре). */
export const TIERS: readonly Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];

/** Слагаемые пути игрока в airdrop (иконки; подписи — в словаре, без обещаний наград и сумм). */
export const JOURNEY_PILLARS = ['Activity', 'Progression', 'Achievements', 'Community'] as const;

/** Предложения партнёрам (иконки; тексты — в словаре). */
export const PARTNER_OFFERS = ['Audience', 'Ecosystem', 'Growth', 'Events', 'Rewards', 'Visibility'] as const;

/** Игровой цикл: играй → собирай → развивай → открывай → возвращайся (иконки; тексты — в словаре). */
export const LOOP = ['Play', 'Collect', 'Grow', 'Discover', 'Return'] as const;

/** Этапы roadmap и их состояние — честно: «Live» только у того, что уже работает в игре. */
export const ROADMAP = ['done', 'done', 'now', 'next', 'later'] as const;

/** Числа игры, которые показывает сайт (в игре они приходят с сервера — здесь те же значения). */
export const GAME_FACTS = {
  startBonus: START_BONUS,
  maxLevel: MAX_LEVEL,
  leagues: 10,
  energy: { max: 5000, regenPerSec: 3 },
  turbo: { seconds: 60, multiplier: 5, perDay: 3 },
  fullEnergy: { perDay: 6 },
  assets: 59,
  /** ежедневная награда по дням серии (10 дней, затем цикл заново) */
  daily: [500, 1_000, 2_000, 3_500, 5_000, 7_500, 10_000, 15_000, 25_000, 50_000],
} as const;

/** Лиги по порядку: порог (заработано за всё время) и цвет — как в backend/src/game/config/leagues.ts. */
export const LEAGUES = [
  { name: 'Bronze', threshold: 0, color: '#cd7f32' },
  { name: 'Silver', threshold: 5_000, color: '#c0c7d1' },
  { name: 'Gold', threshold: 1_000_000, color: '#ffc93c' },
  { name: 'Platinum', threshold: 10_000_000, color: '#7fe3ff' },
  { name: 'Diamond', threshold: 120_000_000, color: '#4f9dff' },
  { name: 'Epic', threshold: 1_500_000_000, color: '#a66bff' },
  { name: 'Legendary', threshold: 15_000_000_000, color: '#ff4fa3' },
  { name: 'Master', threshold: 70_000_000_000, color: '#ff5f3d' },
  { name: 'Grandmaster', threshold: 240_000_000_000, color: '#2ed39a' },
  { name: 'Lord', threshold: 700_000_000_000, color: '#ffffff' },
] as const;

/** Монеты, которые летят вокруг камеры в разделе прокачки: тикер, палитра (как в игре) и категория. */
export const FLOATING_ASSETS = [
  { ticker: 'TON', palette: 5 },
  { ticker: 'SOL', palette: 2 },
  { ticker: 'ETH', palette: 9 },
  { ticker: 'BTC', palette: 8 },
  { ticker: 'DOGE', palette: 0 },
  { ticker: 'LINK', palette: 5 },
  { ticker: 'NOT', palette: 10 },
  { ticker: 'UNI', palette: 6 },
  { ticker: 'MEOW', palette: 0 },
  { ticker: 'AVAX', palette: 11 },
] as const;

/** Требования Airdrop (как в игре) и демо-прогресс для сайта. */
export const AIRDROP_REQS: ReadonlyArray<{ id: AirdropRequirementId; demo: number }> = [
  { id: 'league', demo: 1 },
  { id: 'level', demo: 1 },
  { id: 'friends', demo: 0.66 },
  { id: 'streak', demo: 1 },
  { id: 'cards', demo: 0.5 },
  { id: 'tasks', demo: 0.8 },
];

// требования сайта — те же, что у игры (порядок и состав)
if (import.meta.env.DEV && AIRDROP_REQS.map((r) => r.id).join() !== AIRDROP_REQUIREMENTS.join()) {
  console.warn('site: airdrop requirements differ from the game');
}
