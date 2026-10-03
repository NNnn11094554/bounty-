/**
 * Крипто-активы — главная экономика игры (в коде и БД они по-прежнему «карточки»). Это игровые предметы,
 * а не настоящая криптовалюта и не инвестиции: их нельзя вывести, продать или перевести.
 *
 * ВСЯ экономика активов — в этом файле: тиры, цены, доход, уровни, коэффициенты и цены в Stars.
 *   цена уровня n:     round(baseCost × costMultiplier^(n−1))
 *   прибыль уровня n:  round(baseProfit × profitMultiplier^(n−1)) — прирост дохода в час за этот уровень
 *   окупаемость:       payback_time = цена уровня / прирост дохода в час за него
 * Первые уровни окупаются за часы, средние требуют прогресса, последние — цели на месяцы.
 * Проверка: npm run balance-check, симуляция игрока: npm run economy-sim.
 *
 * Открытие: ASSET_UNLOCK.free самых дешёвых активов открываются за монеты, остальные — за Telegram Stars,
 * и цена в Stars растёт в том же порядке, что и цена в монетах (от дешёвого к дорогому). Прокачка
 * со 2-го уровня у всех активов — только за монеты.
 *
 * Иконка токена — "token/ТИКЕР/palette" (своя стилизованная монета), у особых активов и событий —
 * "glyph/badge/palette" (см. shared/src/cards.ts). Никаких логотипов настоящих проектов и компаний.
 */
import type { CardCategory, CardRarity } from '@meowgul/shared';

export type CardCondition =
  | { type: 'card'; cardId: string; level: number }
  | { type: 'friends'; count: number }
  | { type: 'task'; taskId: string }
  | { type: 'league'; level: number };

export interface CardConfig {
  id: string;
  category: CardCategory;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  icon: string;
  rarity: CardRarity;
  baseCost: number;
  baseProfit: number;
  costMultiplier: number;
  profitMultiplier: number;
  maxLevel: number;
  cooldownSec: number;
  condition: CardCondition | null;
  /** цена открытия в Telegram Stars; null — открывается за монеты */
  starsPrice: number | null;
  isLimited: boolean;
  sortOrder: number;
}

type Tier = 1 | 2 | 3 | 4 | 5 | 6;

/** Потолок прироста дохода за один уровень любого актива, монет в час. */
export const MAX_LEVEL_PROFIT = 2_000_000;

/** Цена уровня не превышает MAX_LEVEL_PRICE — числа остаются точными целыми и читаемыми. */
export const MAX_LEVEL_PRICE = 1e15;

/**
 * Тиры активов — место актива в долгой прогрессии. Для каждого тира задано:
 *  - cost — базовая цена 1-го уровня;
 *  - payback — окупаемость 1-го уровня (ч): дешёвые окупаются за часы, дорогие — за дни;
 *  - lastPayback — окупаемость последнего уровня (ч): последние уровни — цели на месяцы и годы;
 *  - profitGrowth — во сколько раз растёт прирост дохода с каждым уровнем (доход ускоряется).
 * Рост цены уровня подбирается для каждого актива так, чтобы окупаемость плавно (геометрически) шла
 * от payback к lastPayback — без «стены», где каждый следующий уровень вдвое дороже, и без уровня,
 * который выгоднее предыдущего (нет одной «лучшей» покупки навсегда). Ни один уровень не даёт больше
 * MAX_LEVEL_PROFIT в час.
 */
interface TierSpec {
  cost: number;
  payback: number;
  lastPayback: number;
  profitGrowth: number;
  rarity: CardRarity;
}
export const TIERS: Record<Tier, TierSpec> = {
  1: { cost: 1_000, payback: 5, lastPayback: 3_000, profitGrowth: 1.2, rarity: 'common' },
  2: { cost: 12_000, payback: 9, lastPayback: 6_000, profitGrowth: 1.18, rarity: 'common' },
  3: { cost: 150_000, payback: 20, lastPayback: 12_000, profitGrowth: 1.16, rarity: 'rare' },
  4: { cost: 2_000_000, payback: 45, lastPayback: 26_000, profitGrowth: 1.14, rarity: 'epic' },
  5: { cost: 25_000_000, payback: 100, lastPayback: 40_000, profitGrowth: 1.12, rarity: 'legendary' },
  6: { cost: 300_000_000, payback: 240, lastPayback: 60_000, profitGrowth: 1.08, rarity: 'legendary' },
};

/** Максимальный уровень: токены — 25, особые активы — 20, лимитированные события — 10. */
export const ASSET_MAX_LEVEL = { token: 25, special: 20, limited: 10 } as const;

/**
 * Открытие активов. Самые дешёвые `free` активов (по цене 1-го уровня в монетах) открываются за монеты,
 * остальные — за Stars: от minStars у самого дешёвого платного до maxStars у самого дорогого, по
 * геометрической прогрессии и строго в порядке цены в монетах. Цены можно поправить в админке.
 */
export const ASSET_UNLOCK = { free: 6, minStars: 5, maxStars: 750 } as const;

/** Рост цены уровня, при котором последний уровень окупается за lastPayback часов (с учётом потолка дохода). */
function solveCostMultiplier(
  baseCost: number,
  baseProfit: number,
  profitMultiplier: number,
  maxLevel: number,
  lastPayback: number,
): number {
  if (maxLevel <= 1) return 1.5;
  const profitAt = Math.min(MAX_LEVEL_PROFIT, baseProfit * profitMultiplier ** (maxLevel - 1));
  // цена последнего уровня = lastPayback × его прибыль; отсюда рост цены за уровень
  const cm = ((lastPayback * profitAt) / baseCost) ** (1 / (maxLevel - 1));
  // окупаемость не должна падать от уровня к уровню: цена растёт не медленнее прибыли
  return Math.round(Math.max(cm, profitMultiplier + 0.01) * 10_000) / 10_000;
}

function twoDigits(n: number): number {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

/** Канал Telegram из задания «Подписаться на канал» (см. tasks.ts). */
export const CHANNEL_TASK_ID = 'tg_channel';

interface Def {
  id: string;
  tier: Tier;
  /** множитель цены внутри тира */
  k?: number;
  icon: string;
  ru: [string, string];
  en: [string, string];
  cond?: CardCondition;
  /** кулдаун после покупки уровня, сек */
  cd?: number;
  max?: number;
}

const card = (cardId: string, level: number): CardCondition => ({ type: 'card', cardId, level });
const friends = (count: number): CardCondition => ({ type: 'friends', count });
const league = (level: number): CardCondition => ({ type: 'league', level });
const task = (taskId: string): CardCondition => ({ type: 'task', taskId });
/** Иконка токена: своя монета с тикером в цветах палитры. */
const token = (ticker: string, palette: number) => `token/${ticker}/${palette}`;

const HOUR = 3600;

/** Блокчейны первого уровня: свои сети. */
const LAYER1: Def[] = [
  {
    id: 'ton',
    tier: 1,
    k: 0.6,
    icon: token('TON', 5),
    ru: ['Toncoin', 'Сеть, которая живёт прямо в мессенджере. Кот перевёл бы монеты даже лапой.'],
    en: ['Toncoin', 'A network that lives right inside the messenger. The cat could send coins with a paw.'],
  },
  {
    id: 'ada',
    tier: 1,
    k: 0.8,
    icon: token('ADA', 9),
    ru: ['Cardano', 'Всё по науке: сначала статья, потом обновление. Кот читает рецензии.'],
    en: ['Cardano', 'Science first: a paper, then an upgrade. The cat reads the peer reviews.'],
  },
  {
    id: 'xrp',
    tier: 1,
    k: 0.9,
    icon: token('XRP', 10),
    ru: ['XRP', 'Переводы через океан за секунды. Кот так и не понял, зачем ждать дольше.'],
    en: ['XRP', 'Payments across the ocean in seconds. The cat never got why anyone waits longer.'],
  },
  {
    id: 'trx',
    tier: 1,
    k: 1.3,
    icon: token('TRX', 11),
    ru: ['Tron', 'Быстрые и дешёвые переводы. Хватает даже на лишнюю банку корма.'],
    en: ['Tron', 'Fast and cheap transfers. Enough left over for an extra can of food.'],
    cond: card('ton', 3),
  },
  {
    id: 'xlm',
    tier: 2,
    k: 0.9,
    icon: token('XLM', 3),
    ru: ['Stellar', 'Звёздная сеть для переводов. Кот смотрит на звёзды и считает комиссии.'],
    en: ['Stellar', 'A starry network for payments. The cat watches the stars and counts the fees.'],
    cond: card('xrp', 3),
  },
  {
    id: 'algo',
    tier: 2,
    k: 1,
    icon: token('ALGO', 10),
    ru: ['Algorand', 'Блоки летят без форков. Кот тоже никогда не сомневается.'],
    en: ['Algorand', 'Blocks fly without forks. The cat never hesitates either.'],
    cond: card('ada', 4),
  },
  {
    id: 'ltc',
    tier: 2,
    k: 1.1,
    icon: token('LTC', 5),
    ru: ['Litecoin', 'Серебро к цифровому золоту. Блестит, и кот это одобряет.'],
    en: ['Litecoin', 'Silver to digital gold. It shines, and the cat approves.'],
  },
  {
    id: 'atom',
    tier: 2,
    k: 1.25,
    icon: token('ATOM', 9),
    ru: ['Cosmos', 'Интернет блокчейнов. Кот дружит со всеми сетями сразу.'],
    en: ['Cosmos', 'The internet of blockchains. The cat is friends with every chain at once.'],
    cond: friends(1),
  },
  {
    id: 'dot',
    tier: 3,
    k: 0.9,
    icon: token('DOT', 6),
    ru: ['Polkadot', 'Парачейны, как миски в ряд: из каждой можно поесть.'],
    en: ['Polkadot', 'Parachains like bowls in a row: you can eat from every one.'],
    cond: card('atom', 3),
  },
  {
    id: 'hbar',
    tier: 3,
    k: 1,
    icon: token('HBAR', 10),
    ru: ['Hedera', 'Не цепочка, а граф. Кот любит, когда клубок запутан красиво.'],
    en: ['Hedera', 'Not a chain but a graph. The cat loves a beautifully tangled ball of yarn.'],
    cond: card('xlm', 5),
  },
  {
    id: 'near',
    tier: 3,
    k: 1.1,
    icon: token('NEAR', 7),
    ru: ['NEAR', 'Шардинг: сеть делится на части, как кот делит диван с хозяином.'],
    en: ['NEAR', 'Sharding: the network splits up like the cat shares the sofa.'],
    cond: league(2),
  },
  {
    id: 'apt',
    tier: 3,
    k: 1.2,
    icon: token('APT', 3),
    ru: ['Aptos', 'Параллельные транзакции. Кот тоже умеет спать и следить одновременно.'],
    en: ['Aptos', 'Parallel transactions. The cat can also sleep and watch at the same time.'],
    cd: HOUR,
  },
  {
    id: 'bch',
    tier: 3,
    k: 1.3,
    icon: token('BCH', 4),
    ru: ['Bitcoin Cash', 'Большие блоки — больше места. Как большая коробка для кота.'],
    en: ['Bitcoin Cash', 'Bigger blocks, more room. Like a bigger box for the cat.'],
    cond: card('ltc', 5),
  },
  {
    id: 'sui',
    tier: 4,
    k: 0.9,
    icon: token('SUI', 5),
    ru: ['Sui', 'Объекты вместо счетов. Кот — главный объект в доме.'],
    en: ['Sui', 'Objects instead of accounts. The cat is the main object in the house.'],
    cond: card('apt', 5),
  },
  {
    id: 'avax',
    tier: 4,
    k: 1.05,
    icon: token('AVAX', 11),
    ru: ['Avalanche', 'Подтверждение лавиной. Кот вызывает лавину, роняя всё с полки.'],
    en: ['Avalanche', 'Avalanche consensus. The cat triggers one by knocking things off the shelf.'],
    cond: league(3),
  },
  {
    id: 'sol',
    tier: 4,
    k: 1.2,
    icon: token('SOL', 2),
    ru: ['Solana', 'Тысячи транзакций в секунду. Быстрее, чем кот прыгает на стол.'],
    en: ['Solana', 'Thousands of transactions per second. Faster than the cat jumps on the table.'],
    cond: card('near', 5),
    cd: 2 * HOUR,
  },
  {
    id: 'bnb',
    tier: 5,
    k: 0.9,
    icon: token('BNB', 0),
    ru: ['BNB', 'Тяжёлая золотая монета большой сети. Кот носит её с гордостью.'],
    en: ['BNB', 'A heavy gold coin of a big network. The cat wears it with pride.'],
    cond: league(4),
  },
  {
    id: 'eth',
    tier: 5,
    k: 1.15,
    icon: token('ETH', 9),
    ru: ['Ethereum', 'Мировой компьютер. Кот запускает на нём умные контракты на корм.'],
    en: ['Ethereum', 'The world computer. The cat runs smart contracts for food on it.'],
    cond: card('sol', 8),
    cd: 4 * HOUR,
  },
  {
    id: 'btc',
    tier: 6,
    k: 1,
    icon: token('BTC', 8),
    ru: ['Bitcoin', 'Цифровое золото и король рынка. Кот хранит его под лежанкой.'],
    en: ['Bitcoin', 'Digital gold and the king of the market. The cat keeps it under its bed.'],
    cond: league(5),
    cd: 8 * HOUR,
  },
];

/** DeFi, оракулы и сети второго уровня. */
const DEFI: Def[] = [
  {
    id: 'link',
    tier: 1,
    k: 1,
    icon: token('LINK', 5),
    ru: ['Chainlink', 'Оракул приносит данные в сеть. Кот приносит мышь к порогу.'],
    en: ['Chainlink', 'An oracle brings data on-chain. The cat brings a mouse to the door.'],
  },
  {
    id: 'uni',
    tier: 1,
    k: 1.2,
    icon: token('UNI', 6),
    ru: ['Uniswap', 'Обмен без посредников: лапа к лапе, токен к токену.'],
    en: ['Uniswap', 'Swaps without middlemen: paw to paw, token to token.'],
    cond: card('link', 3),
  },
  {
    id: 'grt',
    tier: 1,
    k: 1.45,
    icon: token('GRT', 2),
    ru: ['The Graph', 'Поисковик по блокчейнам. Кот так ищет спрятанную игрушку.'],
    en: ['The Graph', 'A search engine for blockchains. That is how the cat finds hidden toys.'],
  },
  {
    id: 'crv',
    tier: 2,
    k: 0.9,
    icon: token('CRV', 11),
    ru: ['Curve', 'Обмен стейблов с крошечной разницей. Кот ценит точность.'],
    en: ['Curve', 'Stablecoin swaps with a tiny spread. The cat values precision.'],
    cond: card('uni', 3),
  },
  {
    id: 'ldo',
    tier: 2,
    k: 1.05,
    icon: token('LDO', 3),
    ru: ['Lido', 'Жидкий стейкинг: монеты работают, а кот спит.'],
    en: ['Lido', 'Liquid staking: the coins work while the cat sleeps.'],
    cond: task(CHANNEL_TASK_ID),
  },
  {
    id: 'arb',
    tier: 2,
    k: 1.2,
    icon: token('ARB', 5),
    ru: ['Arbitrum', 'Свёртки над большой сетью. Как кот, свернувшийся клубком на ноутбуке.'],
    en: ['Arbitrum', 'Rollups on top of a big network. Like the cat curled up on a laptop.'],
    cond: card('grt', 4),
  },
  {
    id: 'op',
    tier: 3,
    k: 0.95,
    icon: token('OP', 11),
    ru: ['Optimism', 'Оптимистичные свёртки. Кот тоже оптимист: миска наполнится.'],
    en: ['Optimism', 'Optimistic rollups. The cat is an optimist too: the bowl will fill up.'],
    cond: card('arb', 5),
  },
  {
    id: 'pol',
    tier: 3,
    k: 1.05,
    icon: token('POL', 2),
    ru: ['Polygon', 'Много граней — много сетей. Кот видит все грани сразу.'],
    en: ['Polygon', 'Many sides, many networks. The cat sees all of them at once.'],
    cond: friends(3),
  },
  {
    id: 'inj',
    tier: 3,
    k: 1.2,
    icon: token('INJ', 3),
    ru: ['Injective', 'Сеть для торговли. Кот торгуется за каждую креветку.'],
    en: ['Injective', 'A chain built for trading. The cat haggles over every shrimp.'],
    cd: HOUR,
  },
  {
    id: 'fil',
    tier: 4,
    k: 0.95,
    icon: token('FIL', 7),
    ru: ['Filecoin', 'Хранилище файлов по всему миру. Кот хранит там фото себя.'],
    en: ['Filecoin', 'File storage around the world. The cat keeps its selfies there.'],
    cond: league(3),
  },
  {
    id: 'jup',
    tier: 4,
    k: 1.1,
    icon: token('JUP', 4),
    ru: ['Jupiter', 'Агрегатор лучших обменов. Кот всегда находит лучшую миску.'],
    en: ['Jupiter', 'An aggregator of the best swaps. The cat always finds the best bowl.'],
    cond: card('crv', 8),
  },
  {
    id: 'render',
    tier: 4,
    k: 1.25,
    icon: token('RNDR', 1),
    ru: ['Render', 'Видеокарты всего мира рендерят 3D. Кот позирует для каждого кадра.'],
    en: ['Render', 'GPUs around the world render 3D. The cat poses for every frame.'],
    cond: card('inj', 6),
    cd: 2 * HOUR,
  },
  {
    id: 'tao',
    tier: 5,
    k: 1,
    icon: token('TAO', 10),
    ru: ['Bittensor', 'Сеть нейросетей. Кот учит их отличать корм от пустой миски.'],
    en: ['Bittensor', 'A network of neural nets. The cat teaches them food from an empty bowl.'],
    cond: league(4),
  },
  {
    id: 'aave',
    tier: 6,
    k: 1,
    icon: token('AAVE', 6),
    ru: ['Aave', 'Крупнейшее кредитование без банков. Кот выдаёт займы под залог мышей.'],
    en: ['Aave', 'The biggest lending without banks. The cat lends against mice as collateral.'],
    cond: card('tao', 5),
    cd: 8 * HOUR,
  },
];

/** Мемкоины: смешно, громко и неожиданно доходно. */
const MEME: Def[] = [
  {
    id: 'doge',
    tier: 1,
    k: 0.5,
    icon: token('DOGE', 0),
    ru: ['Dogecoin', 'Самый известный мемкоин. Кот делает вид, что не завидует собаке.'],
    en: ['Dogecoin', 'The most famous meme coin. The cat pretends not to envy the dog.'],
  },
  {
    id: 'not',
    tier: 1,
    k: 0.7,
    icon: token('NOT', 10),
    ru: ['Notcoin', 'Начался с тапов, как и наш кот. Тапай — и всё будет.'],
    en: ['Notcoin', 'It started with taps, just like our cat. Keep tapping.'],
  },
  {
    id: 'shib',
    tier: 1,
    k: 1.15,
    icon: token('SHIB', 8),
    ru: ['Shiba Inu', 'Ещё одна собака на рынке. Кот присматривает за ней.'],
    en: ['Shiba Inu', 'Another dog on the market. The cat keeps an eye on it.'],
    cond: card('doge', 3),
  },
  {
    id: 'floki',
    tier: 2,
    k: 0.9,
    icon: token('FLOKI', 0),
    ru: ['Floki', 'Собака-викинг. Кот-викинг пока в разработке.'],
    en: ['Floki', 'A viking dog. The viking cat is still in development.'],
    cond: card('shib', 3),
  },
  {
    id: 'bonk',
    tier: 2,
    k: 1.05,
    icon: token('BONK', 8),
    ru: ['Bonk', 'Громкое имя, громкий рост. Кот вздрагивает от каждого «бонк».'],
    en: ['Bonk', 'A loud name, loud pumps. The cat flinches at every bonk.'],
    cond: card('not', 5),
  },
  {
    id: 'dogs',
    tier: 2,
    k: 1.2,
    icon: token('DOGS', 10),
    ru: ['Dogs', 'Мем-сообщество с миллионами участников. Кот против, но держит.'],
    en: ['Dogs', 'A meme community of millions. The cat objects, but holds.'],
    cond: friends(2),
  },
  {
    id: 'pepe',
    tier: 3,
    k: 0.95,
    icon: token('PEPE', 4),
    ru: ['Pepe', 'Зелёный мем, который знают все. Кот смотрит с уважением.'],
    en: ['Pepe', 'The green meme everyone knows. The cat looks on with respect.'],
    cond: card('floki', 5),
  },
  {
    id: 'wif',
    tier: 3,
    k: 1.1,
    icon: token('WIF', 1),
    ru: ['dogwifhat', 'Собака в шапке. Кот тоже примерил шапку — ему идёт больше.'],
    en: ['dogwifhat', 'A dog in a hat. The cat tried one on too — it suits him better.'],
    cd: HOUR,
  },
  {
    id: 'brett',
    tier: 3,
    k: 1.25,
    icon: token('BRETT', 5),
    ru: ['Brett', 'Синий друг из мемов. Кот подружился с ним первым.'],
    en: ['Brett', 'The blue meme buddy. The cat befriended him first.'],
    cond: league(2),
  },
  {
    id: 'popcat',
    tier: 4,
    k: 0.95,
    icon: token('POP', 6),
    ru: ['Popcat', 'Кот с открытым ртом покорил интернет. Наш кот считает его коллегой.'],
    en: ['Popcat', 'A cat with an open mouth conquered the internet. Our cat calls him a colleague.'],
    cond: card('pepe', 6),
  },
  {
    id: 'mew',
    tier: 4,
    k: 1.15,
    icon: token('MEW', 2),
    ru: ['Cat in a Dogs World', 'Кот в мире собак. Наконец-то мем про нас.'],
    en: ['Cat in a Dogs World', 'A cat in a world of dogs. Finally, a meme about us.'],
    cond: friends(5),
    cd: 2 * HOUR,
  },
  {
    id: 'pengu',
    tier: 5,
    k: 0.95,
    icon: token('PENGU', 3),
    ru: ['Pudgy Penguins', 'Пухлые пингвины. Кот согласен дружить, если они поделятся рыбой.'],
    en: ['Pudgy Penguins', 'Chubby penguins. The cat agrees to be friends if they share fish.'],
    cond: league(4),
  },
  {
    id: 'mog',
    tier: 5,
    k: 1.2,
    icon: token('MOG', 9),
    ru: ['Mog Coin', 'Кот в тёмных очках, который всех переиграл.'],
    en: ['Mog Coin', 'A cat in shades who outplayed everyone.'],
    cond: card('popcat', 8),
  },
  {
    id: 'meow',
    tier: 6,
    k: 1,
    icon: token('MEOW', 0),
    ru: ['Монета Meowgul', 'Легендарная монета нашего кота. Только в игре — и только для своих.'],
    en: ['Meowgul Coin', 'Our cat’s legendary coin. In-game only — and only for insiders.'],
    cond: league(5),
    cd: 8 * HOUR,
  },
];

/** Особые активы: крипто-инфраструктура кота. */
const SPECIALS: Def[] = [
  {
    id: 'in_gpu',
    tier: 1,
    k: 1.5,
    icon: 'chip/bolt/9',
    ru: ['Майнинг-видеокарта', 'Греет комнату и монеты. Кот спит прямо на ней.'],
    en: ['Mining GPU', 'Warms the room and the coins. The cat sleeps right on top of it.'],
  },
  {
    id: 'in_node',
    tier: 2,
    k: 1,
    icon: 'server/check/3',
    ru: ['Нода валидатора', 'Проверяет блоки круглые сутки. Кот проверяет ноду.'],
    en: ['Validator Node', 'Checks blocks around the clock. The cat checks the node.'],
    cond: card('ton', 5),
  },
  {
    id: 'in_pool',
    tier: 2,
    k: 1.2,
    icon: 'coins/lock/0',
    ru: ['Стейкинг-пул', 'Монеты всей команды работают вместе. Как котята в одной корзинке.'],
    en: ['Staking Pool', 'The whole team’s coins work together. Like kittens in one basket.'],
    cond: card('ada', 6),
  },
  {
    id: 'in_bridge',
    tier: 3,
    k: 0.9,
    icon: 'bridge/none/5',
    ru: ['Кросс-чейн мост', 'Монеты переходят между сетями. Кот переходит между подоконниками.'],
    en: ['Cross-chain Bridge', 'Coins hop between networks. The cat hops between windowsills.'],
    cond: card('dot', 3),
  },
  {
    id: 'in_oracle',
    tier: 3,
    k: 1.05,
    icon: 'crystal_ball/eye/2',
    ru: ['Оракул цен', 'Знает курс раньше всех. Кот знает, когда откроют холодильник.'],
    en: ['Price Oracle', 'Knows the price before anyone. The cat knows when the fridge opens.'],
    cond: card('link', 8),
  },
  {
    id: 'in_farm',
    tier: 3,
    k: 1.2,
    icon: 'building/bolt/8',
    ru: ['Майнинг-ферма', 'Сотни видеокарт и один очень тёплый кот.'],
    en: ['Mining Farm', 'Hundreds of GPUs and one very warm cat.'],
    cond: card('in_gpu', 5),
    cd: HOUR,
  },
  {
    id: 'in_vault',
    tier: 4,
    k: 1,
    icon: 'vault/lock/10',
    ru: ['Холодное хранилище', 'Монеты под замком и вне сети. Ключ — у кота под лапой.'],
    en: ['Cold Storage', 'Coins locked up and offline. The key is under the cat’s paw.'],
    cond: league(3),
  },
  {
    id: 'in_dex',
    tier: 4,
    k: 1.15,
    icon: 'candles/DeFi/4',
    ru: ['Своя биржа', 'Децентрализованный обмен под управлением кота. Комиссия — одна креветка.'],
    en: ['Own DEX', 'A decentralized exchange run by the cat. The fee is one shrimp.'],
    cond: card('uni', 10),
  },
  {
    id: 'in_dao',
    tier: 4,
    k: 1.3,
    icon: 'people/DAO/6',
    ru: ['DAO котов', 'Все решения — голосованием. Кот голосует за обед.'],
    en: ['Cat DAO', 'Every decision is voted on. The cat votes for lunch.'],
    cond: friends(7),
    cd: 2 * HOUR,
  },
  {
    id: 'in_datacenter',
    tier: 5,
    k: 1,
    icon: 'server/AI/9',
    ru: ['Дата-центр', 'Целое здание серверов. Кот знает каждый тёплый угол.'],
    en: ['Data Center', 'A whole building of servers. The cat knows every warm corner.'],
    cond: league(4),
  },
  {
    id: 'in_satellite',
    tier: 5,
    k: 1.2,
    icon: 'satellite/globe/5',
    ru: ['Спутниковая нода', 'Блоки прямо из космоса. Кот машет спутнику лапой.'],
    en: ['Satellite Node', 'Blocks straight from space. The cat waves at the satellite.'],
    cond: card('in_node', 10),
    cd: 4 * HOUR,
  },
  {
    id: 'in_quantum',
    tier: 6,
    k: 1,
    icon: 'chip/AI/2',
    ru: ['Квантовый сервер', 'Считает всё сразу и ничего одновременно. Кот Шрёдингера одобряет.'],
    en: ['Quantum Server', 'Computes everything and nothing at once. Schrödinger’s cat approves.'],
    cond: league(6),
    cd: 8 * HOUR,
  },
];

/** События: лимитированные активы — в продаже только в своё окно (расписание — в админке или ротация). */
const LIMITED: Def[] = [
  {
    id: 'ev_hackathon',
    tier: 2,
    k: 0.9,
    icon: 'laptop/API/3',
    ru: ['Хакатон', 'Двое суток кода, пиццы и кота на клавиатуре.'],
    en: ['Hackathon', 'Two days of code, pizza and a cat on the keyboard.'],
  },
  {
    id: 'ev_halving',
    tier: 2,
    k: 1,
    icon: 'cake/x2/6',
    ru: ['Халвинг', 'Награда за блок делится пополам, торт — нет.'],
    en: ['Halving', 'The block reward gets halved, the cake does not.'],
  },
  {
    id: 'ev_newyear',
    tier: 2,
    k: 1.1,
    icon: 'tree/star/4',
    ru: ['Новогодний рост', 'Рынок наряжается в зелёное. Кот наряжается в гирлянду.'],
    en: ['New Year Rally', 'The market dresses in green. The cat dresses in tinsel.'],
  },
  {
    id: 'ev_airdrop_season',
    tier: 2,
    k: 1.2,
    icon: 'gift/star/1',
    ru: ['Сезон аирдропов', 'Подарки падают с неба. Кот ловит их лапой.'],
    en: ['Airdrop Season', 'Gifts fall from the sky. The cat catches them with a paw.'],
  },
  {
    id: 'ev_altseason',
    tier: 3,
    k: 1,
    icon: 'fireworks/none/9',
    ru: ['Альтсезон', 'Растёт всё, даже то, что не должно. Кот празднует.'],
    en: ['Altseason', 'Everything pumps, even what shouldn’t. The cat celebrates.'],
  },
  {
    id: 'ev_bull_run',
    tier: 3,
    k: 1.1,
    icon: 'bull/fire/4',
    ru: ['Бычий забег', 'Быки бегут вверх, кот бежит за ними.'],
    en: ['Bull Run', 'The bulls run up, the cat runs after them.'],
  },
  {
    id: 'ev_mainnet',
    tier: 3,
    k: 1.25,
    icon: 'rocket/star/5',
    ru: ['Запуск мейннета', 'Тестнет позади, ракета на старте. Кот — первый пассажир.'],
    en: ['Mainnet Launch', 'Testnet is over, the rocket is ready. The cat is the first passenger.'],
  },
  {
    id: 'ev_whale',
    tier: 4,
    k: 1,
    icon: 'fish/diamond/5',
    ru: ['Китовая сделка', 'Кит купил на миллион. Кот надеется, что это рыба.'],
    en: ['Whale Trade', 'A whale bought a million. The cat hopes it’s a fish.'],
  },
  {
    id: 'ev_black_friday',
    tier: 4,
    k: 1.2,
    icon: 'bag/percent/11',
    ru: ['Чёрная пятница', 'Скидки на всё. Кот скупил корм на год вперёд.'],
    en: ['Black Friday', 'Everything on sale. The cat bought a year of food.'],
  },
  {
    id: 'ev_to_the_moon',
    tier: 5,
    k: 1,
    icon: 'moon/up/9',
    ru: ['На Луну', 'График смотрит прямо вверх. Кот уже собрал скафандр.'],
    en: ['To the Moon', 'The chart points straight up. The cat has packed its spacesuit.'],
  },
];

function cappedMaxLevel(baseCost: number, costMultiplier: number, wanted: number): number {
  let level = wanted;
  while (level > 1 && baseCost * costMultiplier ** (level - 1) > MAX_LEVEL_PRICE) level--;
  return level;
}

function build(category: CardCategory, defs: Def[], limited = false): CardConfig[] {
  return defs.map((d, i) => {
    const tier = TIERS[d.tier];
    const baseCost = twoDigits(tier.cost * (d.k ?? 1));
    // небольшой разброс окупаемости внутри тира: 0.9–1.15
    const spread = 0.9 + ((i * 7) % 6) * 0.05;
    const payback = tier.payback * spread;
    const baseProfit = Math.min(MAX_LEVEL_PROFIT, Math.max(1, Math.round(baseCost / payback)));
    const profitMultiplier = tier.profitGrowth;
    const wantedMax =
      d.max ??
      (limited
        ? ASSET_MAX_LEVEL.limited
        : category === 'SPECIALS'
          ? ASSET_MAX_LEVEL.special
          : ASSET_MAX_LEVEL.token);
    // окупаемость растёт не круче ×1,4 за уровень — у коротких (лимитированных) активов потолок ниже
    const lastPayback = Math.min(tier.lastPayback * spread, payback * 1.4 ** (wantedMax - 1));
    const costMultiplier = solveCostMultiplier(
      baseCost,
      baseProfit,
      profitMultiplier,
      wantedMax,
      lastPayback,
    );
    return {
      id: d.id,
      category,
      nameRu: d.ru[0],
      nameEn: d.en[0],
      descRu: d.ru[1],
      descEn: d.en[1],
      icon: d.icon,
      rarity: tier.rarity,
      baseCost,
      baseProfit,
      costMultiplier,
      profitMultiplier,
      maxLevel: cappedMaxLevel(baseCost, costMultiplier, wantedMax),
      cooldownSec: d.cd ?? 0,
      condition: d.cond ?? null,
      starsPrice: null,
      isLimited: limited,
      sortOrder: i,
    };
  });
}

/** Красивая цена в Stars: до 20 — целые, до 100 — шаг 5, до 500 — шаг 10, дальше — шаг 25. */
function starsStep(stars: number): number {
  return stars < 20 ? 1 : stars < 100 ? 5 : stars < 500 ? 10 : 25;
}

/**
 * Цены открытия в Stars: самые дешёвые `free` активов — за монеты (null), остальные — по возрастанию цены
 * 1-го уровня в монетах, геометрически от minStars до maxStars, каждая следующая строго дороже.
 */
export function assignStarsPrices(
  cards: readonly CardConfig[],
  unlock: { free: number; minStars: number; maxStars: number } = ASSET_UNLOCK,
): CardConfig[] {
  const order = cards.map((c, i) => ({ c, i })).sort((a, b) => a.c.baseCost - b.c.baseCost || a.i - b.i);
  const paid = order.slice(unlock.free);
  const prices = new Map<string, number>();
  let prev = 0;
  paid.forEach(({ c }, n) => {
    const raw =
      paid.length === 1
        ? unlock.minStars
        : unlock.minStars * (unlock.maxStars / unlock.minStars) ** (n / (paid.length - 1));
    const step = starsStep(raw);
    let price = Math.max(1, Math.round(raw / step) * step);
    if (price <= prev) price = prev + starsStep(prev);
    prices.set(c.id, price);
    prev = price;
  });
  return cards.map((c) => ({ ...c, starsPrice: prices.get(c.id) ?? null }));
}

export const CARDS: readonly CardConfig[] = assignStarsPrices([
  ...build('LAYER1', LAYER1),
  ...build('DEFI', DEFI),
  ...build('MEME', MEME),
  ...build('SPECIALS', SPECIALS),
  ...build('SPECIALS', LIMITED, true).map((c, i) => ({ ...c, sortOrder: 100 + i })),
]);

export const LIMITED_CARD_IDS: readonly string[] = LIMITED.map((d) => d.id);

/**
 * Автоматическая ротация лимитированных активов, для которых админ не задал окно вручную:
 * всегда в продаже `concurrent` активов, каждый по `slotHours` часов, по кругу в порядке sortOrder.
 * Отсчёт — от epoch (день в UTC, час — время ежедневного сброса).
 */
export const LIMITED_ROTATION = { epoch: '2026-01-01', slotHours: 72, concurrent: 2 } as const;

/** Цена покупки уровня level (1 — первая покупка). */
export function cardLevelCost(c: Pick<CardConfig, 'baseCost' | 'costMultiplier'>, level: number): number {
  return Math.round(c.baseCost * c.costMultiplier ** (level - 1));
}

/** Прирост прибыли в час, который даёт уровень level (не больше MAX_LEVEL_PROFIT). */
export function cardLevelProfit(
  c: Pick<CardConfig, 'baseProfit' | 'profitMultiplier'>,
  level: number,
): number {
  return Math.min(MAX_LEVEL_PROFIT, Math.round(c.baseProfit * c.profitMultiplier ** (level - 1)));
}

/** Суммарная прибыль карточки в час на уровне level. */
export function cardTotalProfit(
  c: Pick<CardConfig, 'baseProfit' | 'profitMultiplier'>,
  level: number,
): number {
  let sum = 0;
  for (let n = 1; n <= level; n++) sum += cardLevelProfit(c, n);
  return sum;
}

/** Сколько монет стоили уровни 1…level (для возврата при замене экономики). */
export function cardTotalCost(c: Pick<CardConfig, 'baseCost' | 'costMultiplier'>, level: number): number {
  let sum = 0;
  for (let n = 1; n <= level; n++) sum += cardLevelCost(c, n);
  return sum;
}

/** Окупаемость уровня level в часах: цена уровня / прирост дохода в час за него. */
export function paybackHours(card: CardConfig, level: number): number {
  return cardLevelCost(card, level) / cardLevelProfit(card, level);
}
