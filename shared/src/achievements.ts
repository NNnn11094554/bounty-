import { TON_WALLET_ENABLED } from './features.js';
/**
 * Достижения: условие — показатель игрока не меньше порога. Проверяет и награждает только сервер;
 * клиент берёт отсюда названия, иконки и пороги для прогресса.
 */
import type { Localized } from './cards.js';

/** Показатели игрока, по которым выдаются достижения. */
export const ACHIEVEMENT_METRICS = [
  'taps',
  'earned',
  'profitPerHour',
  'league',
  'multitap',
  'energyLimit',
  'dailyStreak',
  'wallet',
  'hq',
  'cards',
  'cardsLevel10',
  'cardMaxLevel',
  'friends',
  'premiumFriends',
  'combos',
  'ciphers',
  'tasks',
  'goldenCoins',
  'daysPlayed',
] as const;
export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export const ACHIEVEMENT_GROUPS = ['progress', 'business', 'social', 'daily', 'special'] as const;
export type AchievementGroup = (typeof ACHIEVEMENT_GROUPS)[number];

export interface Achievement {
  id: string;
  group: AchievementGroup;
  metric: AchievementMetric;
  threshold: number;
  reward: number;
  /** иконка в формате карточек: "glyph/badge/palette" */
  icon: string;
  name: Localized;
  desc: Localized;
}

const a = (
  id: string,
  group: AchievementGroup,
  metric: AchievementMetric,
  threshold: number,
  reward: number,
  icon: string,
  name: [string, string],
  desc: [string, string],
): Achievement => ({
  id,
  group,
  metric,
  threshold,
  reward,
  icon,
  name: { ru: name[0], en: name[1] },
  desc: { ru: desc[0], en: desc[1] },
});

// prettier-ignore
export const ACHIEVEMENTS: readonly Achievement[] = [
  // ── Прогресс: тапы, заработок, лиги
  a('taps_1k', 'progress', 'taps', 1_000, 5_000, 'cat_head/none/0', ['Разминка лапок', 'Paw warm-up'], ['Сделай 1 000 тапов', 'Make 1,000 taps']),
  a('taps_10k', 'progress', 'taps', 10_000, 25_000, 'cat_head/fire/1', ['Лапа набита', 'Seasoned paw'], ['Сделай 10 000 тапов', 'Make 10,000 taps']),
  a('taps_100k', 'progress', 'taps', 100_000, 150_000, 'cat_head/bolt/2', ['Неутомимый', 'Tireless'], ['Сделай 100 000 тапов', 'Make 100,000 taps']),
  a('taps_1m', 'progress', 'taps', 1_000_000, 1_500_000, 'cat_head/crown/9', ['Миллион касаний', 'A million touches'], ['Сделай 1 000 000 тапов', 'Make 1,000,000 taps']),
  a('earn_100k', 'progress', 'earned', 100_000, 10_000, 'coins/none/0', ['Первая копилка', 'First piggy bank'], ['Заработай 100 000 монет', 'Earn 100,000 coins']),
  a('earn_1m', 'progress', 'earned', 1_000_000, 50_000, 'coins/up/8', ['Миллионер', 'Millionaire'], ['Заработай 1 000 000 монет', 'Earn 1,000,000 coins']),
  a('earn_10m', 'progress', 'earned', 10_000_000, 250_000, 'chest/coin/0', ['Сундук монет', 'Chest of coins'], ['Заработай 10 000 000 монет', 'Earn 10,000,000 coins']),
  a('earn_100m', 'progress', 'earned', 100_000_000, 1_000_000, 'vault/star/9', ['Личное хранилище', 'Private vault'], ['Заработай 100 000 000 монет', 'Earn 100,000,000 coins']),
  a('earn_1b', 'progress', 'earned', 1_000_000_000, 5_000_000, 'bank/crown/2', ['Миллиардер', 'Billionaire'], ['Заработай 1 000 000 000 монет', 'Earn 1,000,000,000 coins']),
  a('earn_10b', 'progress', 'earned', 10_000_000_000, 25_000_000, 'crown/diamond/6', ['Котомагнат', 'Cat tycoon'], ['Заработай 10 000 000 000 монет', 'Earn 10,000,000,000 coins']),
  a('league_1', 'progress', 'league', 1, 2_000, 'medal/none/10', ['Серебряный кот', 'Silver cat'], ['Достигни лиги Silver', 'Reach the Silver league']),
  a('league_2', 'progress', 'league', 2, 5_000, 'medal/star/0', ['Золотой кот', 'Golden cat'], ['Достигни лиги Gold', 'Reach the Gold league']),
  a('league_3', 'progress', 'league', 3, 15_000, 'medal/sparkle/3', ['Платиновый кот', 'Platinum cat'], ['Достигни лиги Platinum', 'Reach the Platinum league']),
  a('league_4', 'progress', 'league', 4, 75_000, 'crystal_ball/diamond/5', ['Бриллиантовый кот', 'Diamond cat'], ['Достигни лиги Diamond', 'Reach the Diamond league']),
  a('league_5', 'progress', 'league', 5, 150_000, 'trophy/bolt/2', ['Эпичный кот', 'Epic cat'], ['Достигни лиги Epic', 'Reach the Epic league']),
  a('league_6', 'progress', 'league', 6, 750_000, 'trophy/fire/6', ['Легенда офиса', 'Office legend'], ['Достигни лиги Legendary', 'Reach the Legendary league']),
  a('league_7', 'progress', 'league', 7, 3_000_000, 'trophy/star/1', ['Мастер мурчания', 'Master of purr'], ['Достигни лиги Master', 'Reach the Master league']),
  a('league_8', 'progress', 'league', 8, 7_500_000, 'trophy/crown/7', ['Гроссмейстер', 'Grandmaster'], ['Достигни лиги Grandmaster', 'Reach the Grandmaster league']),
  a('league_9', 'progress', 'league', 9, 75_000_000, 'crown/sparkle/0', ['Повелитель лап', 'Lord of paws'], ['Достигни лиги Lord', 'Reach the Lord league']),

  // ── Бизнес: прибыль, карточки, бусты
  a('pph_1k', 'business', 'profitPerHour', 1_000, 10_000, 'chart_line/up/4', ['Своё дело', 'Own business'], ['Прибыль 1 000 в час', 'Profit of 1,000 per hour']),
  a('pph_10k', 'business', 'profitPerHour', 10_000, 50_000, 'chart_line/up/3', ['Растущий стартап', 'Growing startup'], ['Прибыль 10 000 в час', 'Profit of 10,000 per hour']),
  a('pph_100k', 'business', 'profitPerHour', 100_000, 250_000, 'bars/fire/5', ['Корпорация', 'Corporation'], ['Прибыль 100 000 в час', 'Profit of 100,000 per hour']),
  a('pph_1m', 'business', 'profitPerHour', 1_000_000, 1_500_000, 'skyscraper/crown/9', ['Империя', 'Empire'], ['Прибыль 1 000 000 в час', 'Profit of 1,000,000 per hour']),
  a('pph_10m', 'business', 'profitPerHour', 10_000_000, 10_000_000, 'globe/diamond/2', ['Мировой лидер', 'World leader'], ['Прибыль 10 000 000 в час', 'Profit of 10,000,000 per hour']),
  a('cards_1', 'business', 'cards', 1, 1_000, 'briefcase/check/8', ['Первая сделка', 'First deal'], ['Купи первую карточку', 'Buy your first card']),
  a('cards_10', 'business', 'cards', 10, 10_000, 'briefcase/plus/1', ['Портфель', 'Portfolio'], ['Открой 10 карточек', 'Unlock 10 cards']),
  a('cards_50', 'business', 'cards', 50, 150_000, 'box/star/3', ['Коллекционер', 'Collector'], ['Открой 50 карточек', 'Unlock 50 cards']),
  a('cards_100', 'business', 'cards', 100, 1_500_000, 'chest/crown/2', ['Всё схвачено', 'Got it all'], ['Открой 100 карточек', 'Unlock 100 cards']),
  a('card_lvl10_1', 'business', 'cardsLevel10', 1, 50_000, 'rocket/up/5', ['Прокачано', 'Levelled up'], ['Прокачай карточку до 10 уровня', 'Upgrade a card to level 10']),
  a('card_lvl10_10', 'business', 'cardsLevel10', 10, 1_000_000, 'rocket/x10/6', ['Десятка десяток', 'Ten by ten'], ['10 карточек 10 уровня', '10 cards at level 10']),
  a('card_lvl20', 'business', 'cardMaxLevel', 20, 2_000_000, 'rocket/fire/11', ['На орбите', 'In orbit'], ['Прокачай карточку до 20 уровня', 'Upgrade a card to level 20']),
  a('multitap_5', 'business', 'multitap', 5, 10_000, 'bolt/x2/0', ['Быстрые лапы', 'Quick paws'], ['Multitap 5 уровня', 'Multitap level 5']),
  a('multitap_10', 'business', 'multitap', 10, 100_000, 'bolt/fire/1', ['Молния', 'Lightning'], ['Multitap 10 уровня', 'Multitap level 10']),
  a('energy_5', 'business', 'energyLimit', 5, 10_000, 'drop/plus/3', ['Запас сил', 'Stamina'], ['Энергия 5 уровня', 'Energy limit level 5']),
  a('energy_10', 'business', 'energyLimit', 10, 100_000, 'drop/bolt/5', ['Батарейка', 'Battery'], ['Энергия 10 уровня', 'Energy limit level 10']),

  // ── Друзья
  a('friends_1', 'social', 'friends', 1, 5_000, 'handshake/plus/4', ['Не один', 'Not alone'], ['Пригласи друга', 'Invite a friend']),
  a('friends_3', 'social', 'friends', 3, 15_000, 'people/none/3', ['Компания', 'Company'], ['Пригласи 3 друзей', 'Invite 3 friends']),
  a('friends_10', 'social', 'friends', 10, 100_000, 'people/star/5', ['Душа офиса', 'Life of the office'], ['Пригласи 10 друзей', 'Invite 10 friends']),
  a('friends_25', 'social', 'friends', 25, 300_000, 'megaphone/fire/1', ['Лидер мнений', 'Opinion leader'], ['Пригласи 25 друзей', 'Invite 25 friends']),
  a('friends_100', 'social', 'friends', 100, 2_500_000, 'stadium/crown/9', ['Целый стадион', 'Whole stadium'], ['Пригласи 100 друзей', 'Invite 100 friends']),
  a('friends_premium', 'social', 'premiumFriends', 1, 25_000, 'gift/star/2', ['Важный гость', 'VIP guest'], ['Пригласи друга с Telegram Premium', 'Invite a friend with Telegram Premium']),

  // ── Каждый день
  a('streak_3', 'daily', 'dailyStreak', 3, 5_000, 'calendar/check/4', ['Привычка', 'Habit'], ['3 дня подряд забирай награду', 'Claim the daily reward 3 days in a row']),
  a('streak_7', 'daily', 'dailyStreak', 7, 25_000, 'calendar/star/3', ['Неделя в деле', 'Week in business'], ['7 дней подряд', '7 days in a row']),
  a('streak_10', 'daily', 'dailyStreak', 10, 100_000, 'calendar/fire/1', ['Полный цикл', 'Full cycle'], ['10 дней подряд', '10 days in a row']),
  a('streak_30', 'daily', 'dailyStreak', 30, 1_000_000, 'calendar/crown/9', ['Железная дисциплина', 'Iron discipline'], ['30 дней подряд', '30 days in a row']),
  a('combo_1', 'daily', 'combos', 1, 100_000, 'magnifier/check/0', ['Сыщик', 'Detective'], ['Собери комбо дня', 'Complete the daily combo']),
  a('combo_7', 'daily', 'combos', 7, 1_000_000, 'magnifier/crown/2', ['Аналитик', 'Analyst'], ['Собери 7 комбо', 'Complete 7 daily combos']),
  a('cipher_1', 'daily', 'ciphers', 1, 50_000, 'lock/key/5', ['Шифровальщик', 'Cryptographer'], ['Разгадай шифр дня', 'Solve the daily cipher']),
  a('cipher_7', 'daily', 'ciphers', 7, 500_000, 'lock/star/9', ['Мастер Морзе', 'Morse master'], ['Разгадай 7 шифров', 'Solve 7 ciphers']),
  a('tasks_1', 'daily', 'tasks', 1, 2_000, 'scroll/check/7', ['Исполнительный', 'Diligent'], ['Выполни задание', 'Complete a task']),
  a('tasks_5', 'daily', 'tasks', 5, 20_000, 'scroll/star/4', ['Ответственный', 'Responsible'], ['Выполни 5 заданий', 'Complete 5 tasks']),
  a('tasks_15', 'daily', 'tasks', 15, 150_000, 'scroll/crown/3', ['Незаменимый', 'Indispensable'], ['Выполни 15 заданий', 'Complete 15 tasks']),
  a('golden_1', 'daily', 'goldenCoins', 1, 5_000, 'coins/sparkle/0', ['Ловкая лапа', 'Swift paw'], ['Поймай золотую монету', 'Catch a golden coin']),
  a('golden_10', 'daily', 'goldenCoins', 10, 50_000, 'coins/star/8', ['Охотник за золотом', 'Gold hunter'], ['Поймай 10 золотых монет', 'Catch 10 golden coins']),
  a('golden_50', 'daily', 'goldenCoins', 50, 500_000, 'coins/crown/11', ['Золотая лихорадка', 'Gold rush'], ['Поймай 50 золотых монет', 'Catch 50 golden coins']),
  a('days_7', 'daily', 'daysPlayed', 7, 25_000, 'clock/check/10', ['Свой в офисе', 'Regular'], ['Заходи в игру 7 дней', 'Play on 7 different days']),
  a('days_30', 'daily', 'daysPlayed', 30, 250_000, 'clock/star/5', ['Ветеран', 'Veteran'], ['Заходи в игру 30 дней', 'Play on 30 different days']),
  a('days_100', 'daily', 'daysPlayed', 100, 2_500_000, 'clock/crown/2', ['Сотня дней', 'Hundred days'], ['Заходи в игру 100 дней', 'Play on 100 different days']),

  // ── Особые
  a('hq_chosen', 'special', 'hq', 1, 1_000, 'building/check/1', ['Свой офис', 'Own office'], ['Выбери штаб-квартиру', 'Choose your headquarters']),
  a('wallet_connected', 'special', 'wallet', 1, 10_000, 'wallet/check/5', ['Кошелёк на месте', 'Wallet ready'], ['Подключи кошелёк TON', 'Connect a TON wallet']),
];

/**
 * Достижения, которые сейчас можно получить: кошелёк TON временно скрыт (TON_WALLET_ENABLED),
 * штаб-квартир в игре больше нет.
 */
export const VISIBLE_ACHIEVEMENTS: readonly Achievement[] = ACHIEVEMENTS.filter(
  (a) => (TON_WALLET_ENABLED || a.metric !== 'wallet') && a.metric !== 'hq',
);

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((x) => x.id === id);
}

/** Значения показателей игрока (для прогресса достижений). */
export type AchievementProgress = Partial<Record<AchievementMetric, number>>;

export interface AchievementStatus {
  id: string;
  /** мс; null — ещё не получено */
  unlockedAt: number | null;
}

export interface ProfileStats {
  totalTaps: number;
  totalEarned: number;
  daysPlayed: number;
  bestDailyStreak: number;
  friends: number;
  cards: number;
  combos: number;
  ciphers: number;
}

export interface ProfileResponse {
  stats: ProfileStats;
  achievements: AchievementStatus[];
  progress: AchievementProgress;
}
