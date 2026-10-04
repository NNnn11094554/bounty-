import { AIRDROP_REQUIREMENTS, MAX_LEVEL, START_BONUS, type AirdropRequirementId } from '@meowgul/shared';

/**
 * Сайт — одна сцена, по которой камера летит от станции к станции: прокрутка двигает камеру,
 * у каждой станции — свой интерфейс поверх сцены.
 */
export const STATIONS = ['home', 'game', 'collection', 'upgrades', 'earn', 'airdrop'] as const;
export type StationId = (typeof STATIONS)[number];

export const STATION_LABEL: Record<StationId, string> = {
  home: 'Главная',
  game: 'Игра',
  collection: 'Коты',
  upgrades: 'Прокачка',
  earn: 'Задания',
  airdrop: 'Airdrop',
};

/** Технические подписи в духе пульта: номер станции и её код. */
export const STATION_CODE: Record<StationId, string> = {
  home: 'HOME',
  game: 'GAME',
  collection: 'COLLECTION',
  upgrades: 'UPGRADES',
  earn: 'EARN / TASKS',
  airdrop: 'AIRDROP',
};

export const stationIndex = (id: StationId): number => STATIONS.indexOf(id);

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

/** Категории активов и примеры (иконки — те же стилизованные монеты, что в игре). */
export const ASSET_GROUPS = [
  { title: 'Блокчейны', icon: 'token/TON/5', examples: 'TON · SOL · ETH · BTC' },
  { title: 'DeFi', icon: 'token/UNI/6', examples: 'LINK · UNI · AAVE' },
  { title: 'Мемы', icon: 'token/DOGE/0', examples: 'DOGE · NOT · MEOW' },
  { title: 'Особые', icon: 'chip/bolt/9', examples: 'инфраструктура кота' },
] as const;

/** Монеты, которые летят вокруг камеры в разделе прокачки: тикер, палитра (как в игре) и категория. */
export const FLOATING_ASSETS = [
  { ticker: 'TON', palette: 5, group: 'Блокчейны' },
  { ticker: 'SOL', palette: 2, group: 'Блокчейны' },
  { ticker: 'ETH', palette: 9, group: 'Блокчейны' },
  { ticker: 'BTC', palette: 8, group: 'Блокчейны' },
  { ticker: 'DOGE', palette: 0, group: 'Мемы' },
  { ticker: 'LINK', palette: 5, group: 'DeFi' },
  { ticker: 'NOT', palette: 10, group: 'Мемы' },
  { ticker: 'UNI', palette: 6, group: 'DeFi' },
  { ticker: 'MEOW', palette: 0, group: 'Мемы' },
  { ticker: 'AVAX', palette: 11, group: 'Блокчейны' },
] as const;

/** Задания (награда — как в игре: комбо и шифр растут вместе с доходом игрока). */
export const TASKS = [
  { title: 'Комбо дня', note: 'найди 3 актива дня', reward: 'от 50 000' },
  { title: 'Шифр дня', note: 'слово азбукой Морзе — тапами', reward: 'от 10 000' },
  { title: 'Пригласи друга', note: 'бонус обоим, за друга с Premium — 25 000', reward: '5 000' },
] as const;

/** Требования Airdrop (как в игре) и демо-прогресс для сайта. */
export const AIRDROP_REQS: ReadonlyArray<{ id: AirdropRequirementId; label: string; demo: number }> = [
  { id: 'league', label: 'Лига Platinum', demo: 1 },
  { id: 'level', label: 'Уровень 10', demo: 1 },
  { id: 'friends', label: 'Пригласи 3 друзей', demo: 0.66 },
  { id: 'streak', label: 'Заходи 7 дней подряд', demo: 1 },
  { id: 'cards', label: 'Открой 6 активов', demo: 0.5 },
  { id: 'tasks', label: 'Выполни 5 заданий', demo: 0.8 },
];

// требования сайта — те же, что у игры (порядок и состав)
if (import.meta.env.DEV && AIRDROP_REQS.map((r) => r.id).join() !== AIRDROP_REQUIREMENTS.join()) {
  console.warn('site: требования Airdrop разошлись с игрой');
}
