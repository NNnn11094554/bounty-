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
  'world',
  'play',
  'collection',
  'airdrop',
  'roadmap',
  'community',
  'final',
] as const;
export type SectionId = (typeof SECTIONS)[number];
export const sectionIndex = (id: SectionId): number => SECTIONS.indexOf(id);

/** Пункты навигации — в порядке страницы. */
export const NAV: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'world', label: 'World' },
  { id: 'play', label: 'How to play' },
  { id: 'collection', label: 'Collection' },
  { id: 'airdrop', label: 'Airdrop' },
  { id: 'roadmap', label: 'Roadmap' },
];

/**
 * Ссылки сообщества. Telegram — бот игры; X и сообщество задаются при сборке (VITE_X_URL,
 * VITE_COMMUNITY_URL) — пока их нет, кнопка показывает «Soon» и никуда не ведёт.
 */
export const LINKS = {
  telegram: `https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'meowgul_bot'}`,
  x: import.meta.env.VITE_X_URL || null,
  community: import.meta.env.VITE_COMMUNITY_URL || null,
};

export const STORY_STEPS = [
  { title: 'The First Cat', text: 'The journey begins.' },
  { title: 'The Collection', text: 'Discover unique characters and rare skins.' },
  { title: 'The Evolution', text: 'Upgrade, progress and unlock new possibilities.' },
  { title: 'The World Expands', text: 'New characters, mechanics and experiences arrive.' },
] as const;

/** Коротко о проекте — только то, что есть в игре сейчас. */
export const KEY_FACTS = [
  { value: '1 tap', label: 'To start', text: 'A Mini App that opens right inside Telegram, no download.' },
  { value: '10', label: 'Characters', text: 'Each with its own world, rarity and story.' },
  { value: `${MAX_LEVEL}`, label: 'Levels', text: 'And ten leagues, from Bronze to Lord.' },
  { value: '59', label: 'Assets', text: 'In-game upgrades that keep earning while you are away.' },
] as const;

export const HOW_STEPS = [
  {
    title: 'Tap',
    text: 'Earn rewards through active gameplay.',
    detail: 'Each tap spends 1 energy. 5,000 energy, refilling at +3 per second.',
  },
  {
    title: 'Upgrade',
    text: 'Improve your progression and unlock new possibilities.',
    detail: '59 assets in four groups earn PAW every hour — offline too, for up to 3 hours.',
  },
  {
    title: 'Collect',
    text: 'Discover unique cats, skins and rare characters.',
    detail: 'Skins change how your cat looks, never the economy: style, not pay-to-win.',
  },
  {
    title: 'Compete',
    text: 'Climb through leagues and prove your place in the world.',
    detail: 'Ten leagues ranked by everything you have earned, from Bronze to Lord.',
  },
] as const;

/** Бусты — как в игре. */
export const BOOSTS = [
  { title: 'Turbo', text: '×5 per tap for 60 s, no energy spent · 3 a day' },
  { title: 'Full energy', text: 'Refill to the top instantly · 6 a day' },
] as const;

/** Ежедневные задания: награда растёт вместе с доходом игрока (как в игре). */
export const DAILY_TASKS = [
  { title: 'Daily combo', text: 'Find the three assets of the day', reward: 'from 50,000' },
  { title: 'Daily cipher', text: 'Tap out the word of the day in Morse code', reward: 'from 10,000' },
  { title: 'Invite friends', text: 'A bonus for both of you · 25,000 with Premium', reward: '5,000' },
] as const;

/** Ступени редкости: у каждой свой характер (цвет — как в игре). */
export const TIERS: ReadonlyArray<{ rarity: Rarity; text: string }> = [
  { rarity: 'COMMON', text: 'Where every collection starts.' },
  { rarity: 'RARE', text: 'Distinct looks, harder to find.' },
  { rarity: 'EPIC', text: 'Characters with their own worlds.' },
  { rarity: 'LEGENDARY', text: 'Icons of the universe.' },
  { rarity: 'MYTHIC', text: 'Almost beyond reach.' },
];

/** Миры вселенной — все пока в будущем (не выдавать за готовые). */
export const WORLDS = [
  {
    name: 'Shadow District',
    text: 'A city ruled by silent hunters and hidden secrets.',
    cat: 'stealth_assassin',
  },
  {
    name: 'Galaxy Frontier',
    text: 'A distant world where cosmic energy shapes everything around it.',
    cat: 'galaxy_emperor',
  },
  { name: 'Ocean Realm', text: 'An ancient kingdom hidden beneath endless waters.', cat: 'ocean_guardian' },
  { name: 'Unknown', text: 'Something is waiting beyond the known world.', cat: null },
] as const;

/** Что учитывается в пути игрока (без обещаний наград и сумм). */
export const JOURNEY_PILLARS = [
  { title: 'Activity', text: 'Play regularly and keep your streak.' },
  { title: 'Progression', text: 'Levels, leagues and upgrades.' },
  { title: 'Achievements', text: 'Tasks and milestones you complete.' },
  { title: 'Community', text: 'Friends you bring along.' },
] as const;

export const ROADMAP = [
  {
    phase: '01',
    title: 'Genesis',
    state: 'done',
    items: ['Core game', 'Telegram Mini App', 'First characters', 'Collection'],
  },
  {
    phase: '02',
    title: 'Expansion',
    state: 'next',
    items: ['New characters', 'New skins', 'More upgrades', 'Events', 'New worlds'],
  },
  {
    phase: '03',
    title: 'Ecosystem',
    state: 'later',
    items: ['Community features', 'Competitive mechanics', 'New game systems'],
  },
  { phase: '04', title: 'Next World', state: 'unknown', items: ['???'] },
] as const;

export const FAQ = [
  {
    q: 'What is the game?',
    a: 'A Telegram-based game built around collecting, progression and an evolving universe of characters.',
  },
  { q: 'How do I start playing?', a: 'Open the Mini App through Telegram and begin your journey.' },
  { q: 'What can I collect?', a: 'Characters, skins, rewards and other in-game assets.' },
  {
    q: 'Will new characters be added?',
    a: 'Yes. The collection and universe are designed to expand over time.',
  },
  {
    q: 'How does the airdrop work?',
    a: 'Participation and progression are part of the current ecosystem experience. Further details can be announced as the system develops.',
  },
] as const;

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
  { ticker: 'TON', palette: 5, group: 'Blockchains' },
  { ticker: 'SOL', palette: 2, group: 'Blockchains' },
  { ticker: 'ETH', palette: 9, group: 'Blockchains' },
  { ticker: 'BTC', palette: 8, group: 'Blockchains' },
  { ticker: 'DOGE', palette: 0, group: 'Memes' },
  { ticker: 'LINK', palette: 5, group: 'DeFi' },
  { ticker: 'NOT', palette: 10, group: 'Memes' },
  { ticker: 'UNI', palette: 6, group: 'DeFi' },
  { ticker: 'MEOW', palette: 0, group: 'Memes' },
  { ticker: 'AVAX', palette: 11, group: 'Blockchains' },
] as const;

/** Требования Airdrop (как в игре) и демо-прогресс для сайта. */
export const AIRDROP_REQS: ReadonlyArray<{ id: AirdropRequirementId; label: string; demo: number }> = [
  { id: 'league', label: 'Reach Platinum league', demo: 1 },
  { id: 'level', label: 'Reach level 10', demo: 1 },
  { id: 'friends', label: 'Invite 3 friends', demo: 0.66 },
  { id: 'streak', label: '7-day streak', demo: 1 },
  { id: 'cards', label: 'Unlock 6 assets', demo: 0.5 },
  { id: 'tasks', label: 'Complete 5 tasks', demo: 0.8 },
];

// требования сайта — те же, что у игры (порядок и состав)
if (import.meta.env.DEV && AIRDROP_REQS.map((r) => r.id).join() !== AIRDROP_REQUIREMENTS.join()) {
  console.warn('site: airdrop requirements differ from the game');
}
