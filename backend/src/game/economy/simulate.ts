/**
 * Симуляция прогресса «обычного активного игрока» на настоящем конфиге экономики.
 * Не 24/7: несколько заходов в день, ночью копится не больше лимита офлайн-дохода, иногда пропуски дней,
 * шифр и комбо — не каждый день, друзья появляются постепенно. Покупает самое выгодное (лучшая окупаемость),
 * а если на него не хватает — копит. По ней настраивается экономика и проверяется тестами.
 * Игрок со Stars открывает платные активы, как только выполнены их условия; бесплатный — только активы
 * за монеты (их прокачка у обоих одинаковая — за монеты).
 */
import {
  MAX_LEVEL,
  playerLevel,
  VISIBLE_ACHIEVEMENTS,
  COSMETICS,
  type AchievementMetric,
} from '@meowgul/shared';
import { boostLevelPrice, BOOSTS } from '../config/boosts.js';
import { CARDS, LIMITED_ROTATION, cardLevelCost, cardLevelProfit, type CardConfig } from '../config/cards.js';
import { EVENTS } from '../config/events.js';
import { GAME, maxEnergy } from '../config/game.js';
import { LEAGUES, leagueForTotal } from '../config/leagues.js';
import { COMBO_MAX_BASE_COST, REFERRAL, cipherReward, comboReward, dailyReward } from '../config/rewards.js';
import { overallProgress, type ProgressParts } from '../progress.js';

export interface PlayerProfile {
  /** часы заходов в игру (по местному времени) */
  sessions: readonly number[];
  /** минут в игре за заход */
  sessionMin: number;
  /** пропускает каждый N-й день (0 — без пропусков) */
  missEveryNthDay: number;
  /** доля дней с разгаданным шифром и собранным комбо */
  cipherRate: number;
  comboRate: number;
  /** полных восстановлений энергии в день */
  fullEnergyPerDay: number;
  /** друзья: [день, всего друзей к этому дню] */
  friends: ReadonlyArray<readonly [number, number]>;
  /** открывает активы за Stars (иначе — только бесплатные) */
  stars: boolean;
}

/** Обычный активный игрок Telegram-игры. */
export const NORMAL_PLAYER: PlayerProfile = {
  sessions: [9, 13, 18, 22],
  sessionMin: 6,
  missEveryNthDay: 7,
  cipherRate: 0.75,
  comboRate: 0.5,
  fullEnergyPerDay: 3,
  friends: [
    [2, 1],
    [6, 2],
    [12, 3],
    [25, 5],
    [45, 7],
    [80, 10],
  ],
  stars: true,
};

/** Тот же игрок, но без покупок за Stars: только бесплатные активы. */
export const FREE_PLAYER: PlayerProfile = { ...NORMAL_PLAYER, stars: false };

export interface Snapshot {
  day: number;
  balance: number;
  totalEarned: number;
  profitPerHour: number;
  cardsOwned: number;
  avgCardLevel: number;
  league: number;
  playerLevel: number;
  progress: ProgressParts;
  /** часов набирать на следующую самую выгодную покупку при текущем доходе */
  nextBuyHours: number;
  nextBuy: string | null;
  /** дней до следующей лиги при текущем темпе */
  nextLeagueDays: number | null;
  /** доступно уровней карточек прямо сейчас (условия выполнены, не на кулдауне) */
  availableUpgrades: number;
  /** сколько звёзд потрачено на открытие активов */
  starsSpent: number;
  /** заработано за последние сутки по источникам */
  income: { passive: number; taps: number; daily: number; other: number };
}

const HOUR = 1;
const DAY = 24 * HOUR;

/** Детерминированный генератор случайных чисел — симуляция повторяема. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIMITED = CARDS.filter((c) => c.isLimited);

function limitedOpen(card: CardConfig, hours: number): boolean {
  const idx = LIMITED.indexOf(card);
  const slot = Math.floor(hours / LIMITED_ROTATION.slotHours);
  const first = (slot * LIMITED_ROTATION.concurrent) % LIMITED.length;
  for (let i = 0; i < LIMITED_ROTATION.concurrent; i++) {
    if ((first + i) % LIMITED.length === idx) return true;
  }
  return false;
}

export function simulate(
  opts: { days: number; profile?: PlayerProfile; snapshotDays?: readonly number[]; seed?: number } = {
    days: 210,
  },
): Snapshot[] {
  const p = opts.profile ?? NORMAL_PLAYER;
  const snapDays = new Set(opts.snapshotDays ?? []);
  const rand = rng(opts.seed ?? 7);
  const lvl = new Map<string, number>(CARDS.map((c) => [c.id, 0]));
  const cooldown = new Map<string, number>();
  let starsSpent = 0;
  let balance = 0;
  let total = 0;
  let pph = 0;
  let taps = 0;
  const multitap = 1; // Multitap больше не продаётся
  let energyLimit = 1;
  let streak = 0;
  let bestStreak = 0;
  let combos = 0;
  let ciphers = 0;
  let daysPlayed = 0;
  let golden = 0;
  let tasksDone = 0;
  let paidLeagueBonus = 0;
  const achieved = new Set<string>();
  const ownedSkins = new Set<string>();
  let lastSeen = 0;
  let missedYesterday = false;
  const income = { passive: 0, taps: 0, daily: 0, other: 0 };
  const dayIncome = { passive: 0, taps: 0, daily: 0, other: 0 };
  const snapshots: Snapshot[] = [];

  const friendsAt = (day: number) => {
    let n = 0;
    for (const [d, count] of p.friends) if (day >= d) n = count;
    return n;
  };
  const earn = (amount: number, kind: keyof typeof income) => {
    balance += amount;
    total += amount;
    income[kind] += amount;
  };

  const condOk = (c: CardConfig, day: number) => {
    const k = c.condition;
    if (!k) return true;
    if (k.type === 'card') return (lvl.get(k.cardId) ?? 0) >= k.level;
    if (k.type === 'friends') return friendsAt(day) >= k.count;
    if (k.type === 'league') return leagueForTotal(total) >= k.level;
    return true; // задания (подписка на канал) выполнены
  };
  /** первый уровень актива за Stars — без монет */
  const paidWithStars = (c: CardConfig) => c.starsPrice !== null && lvl.get(c.id) === 0;
  const coinCost = (c: CardConfig) => (paidWithStars(c) ? 0 : cardLevelCost(c, lvl.get(c.id)! + 1));
  const available = (c: CardConfig, t: number, day: number) => {
    const l = lvl.get(c.id)!;
    if (l >= c.maxLevel) return false;
    if (paidWithStars(c) && !p.stars) return false;
    if ((cooldown.get(c.id) ?? 0) > t) return false;
    if (c.isLimited && !limitedOpen(c, t)) return false;
    return condOk(c, day);
  };
  const bestCard = (t: number, day: number) => {
    let best: CardConfig | null = null;
    let bestPb = Infinity;
    for (const c of CARDS) {
      if (!available(c, t, day)) continue;
      const next = lvl.get(c.id)! + 1;
      const pb = coinCost(c) / cardLevelProfit(c, next);
      if (pb < bestPb) {
        bestPb = pb;
        best = c;
      }
    }
    return best;
  };

  const metric = (m: AchievementMetric, day: number): number => {
    switch (m) {
      case 'taps':
        return taps;
      case 'earned':
        return total;
      case 'league':
        return leagueForTotal(total);
      case 'profitPerHour':
        return pph;
      case 'cards':
        return [...lvl.values()].filter((l) => l > 0).length;
      case 'cardsLevel10':
        return [...lvl.values()].filter((l) => l >= 10).length;
      case 'cardMaxLevel':
        return Math.max(...lvl.values());
      case 'multitap':
        return multitap;
      case 'energyLimit':
        return energyLimit;
      case 'friends':
        return friendsAt(day);
      case 'premiumFriends':
        return 0;
      case 'dailyStreak':
        return bestStreak;
      case 'combos':
        return combos;
      case 'ciphers':
        return ciphers;
      case 'tasks':
        return tasksDone;
      case 'goldenCoins':
        return golden;
      case 'daysPlayed':
        return daysPlayed;
      default:
        return 0;
    }
  };
  const checkAchievements = (day: number) => {
    // награда одного может открыть следующие — как на сервере
    for (let pass = 0; pass < 4; pass++) {
      let any = false;
      for (const a of VISIBLE_ACHIEVEMENTS) {
        if (achieved.has(a.id) || metric(a.metric, day) < a.threshold) continue;
        achieved.add(a.id);
        earn(a.reward, 'other');
        any = true;
      }
      if (!any) break;
    }
  };

  const session = (t: number, day: number, first: boolean) => {
    // пассивный доход с прошлого захода — не больше лимита офлайна
    const gap = Math.min(t - lastSeen, GAME.passive.maxOfflineHours);
    earn(pph * gap, 'passive');
    lastSeen = t;
    if (first) {
      daysPlayed++;
      streak = missedYesterday ? 1 : streak + 1;
      bestStreak = Math.max(bestStreak, streak);
      earn(dailyReward(streak, pph), 'daily');
      if (rand() < p.cipherRate) {
        ciphers++;
        earn(cipherReward(pph), 'daily');
      }
      if (rand() < p.comboRate) {
        // комбо: по уровню трёх недорогих карточек дня — если хватает денег
        const pool = CARDS.filter(
          (c) =>
            !c.isLimited &&
            c.starsPrice === null &&
            c.baseCost <= COMBO_MAX_BASE_COST &&
            available(c, t, day),
        );
        const pick = [0, 1, 2]
          .map(() => pool[Math.floor(rand() * pool.length)])
          .filter(Boolean) as CardConfig[];
        const cost = pick.reduce((s, c) => s + cardLevelCost(c, lvl.get(c.id)! + 1), 0);
        if (pick.length === 3 && new Set(pick).size === 3 && cost <= balance) {
          for (const c of pick) buy(c, t);
          combos++;
          earn(comboReward(pph), 'daily');
        }
      }
      // друзья и их лиги: бонус за друга сразу, за лиги — пока друг растёт (до Platinum за месяц)
      const friends = friendsAt(day);
      const bonusLeagues = Math.min(3, Math.floor(day / 10) + 1);
      const owedLeagueBonus =
        friends * [1, 2, 3].slice(0, bonusLeagues).reduce((s, l) => s + REFERRAL.leagues[l]!, 0);
      const owedFriends = friends * REFERRAL.regular;
      const owed = owedFriends + owedLeagueBonus;
      if (owed > paidLeagueBonus) {
        earn(owed - paidLeagueBonus, 'other');
        paidLeagueBonus = owed;
      }
      // одноразовые задания (канал, друзья) — в первые дни
      if (day === 0 && tasksDone === 0) {
        tasksDone = 1;
        earn(5_000, 'other');
      }
      if (friends >= 3 && tasksDone === 1) {
        tasksDone = 2;
        earn(25_000, 'other');
      }
    }
    // тапы: вся накопленная энергия + восстановление за время в игре + полные энергии + турбо
    const maxE = maxEnergy(energyLimit);
    let energy =
      Math.min(maxE, GAME.energy.regenPerSec * 3600 * Math.max(gap, 0.5)) +
      GAME.energy.regenPerSec * 60 * p.sessionMin;
    if (first) energy += maxE * Math.min(p.fullEnergyPerDay, BOOSTS.fullEnergy.perDay);
    const turbo = first
      ? BOOSTS.turbo.perDay * GAME.turbo.durationSec * 15 * multitap * GAME.turbo.multiplier
      : 0;
    taps += Math.floor(energy / multitap) + (first ? BOOSTS.turbo.perDay * GAME.turbo.durationSec * 15 : 0);
    earn(energy + turbo, 'taps');
    // золотая монета — примерно раз в день
    if (first && rand() < 0.8) {
      golden++;
      earn(Math.max(EVENTS.goldenCoin.minReward, pph * EVENTS.goldenCoin.profitShare), 'other');
    }
    checkAchievements(day);
    spend(t, day);
    checkAchievements(day);
  };

  const buy = (c: CardConfig, t: number) => {
    const next = lvl.get(c.id)! + 1;
    if (paidWithStars(c)) starsSpent += c.starsPrice!;
    balance -= coinCost(c);
    pph += cardLevelProfit(c, next);
    lvl.set(c.id, next);
    if (c.cooldownSec) cooldown.set(c.id, t + c.cooldownSec / 3600);
  };

  const spend = (t: number, day: number) => {
    for (let guard = 0; guard < 500; guard++) {
      const card = bestCard(t, day);
      // бусты и скины — когда стоят не больше нескольких часов дохода (игроку приятно, но не главное)
      const cheap = Math.max(20_000, pph * 4);
      const lvlNow = playerLevel(total).level;
      const skin = COSMETICS.find(
        (s) =>
          s.price?.currency === 'coins' &&
          !ownedSkins.has(s.id) &&
          s.unlockLevel <= lvlNow &&
          s.price.amount <= cheap,
      );
      if (skin?.price && skin.price.amount <= balance) {
        balance -= skin.price.amount;
        ownedSkins.add(skin.id);
        continue;
      }
      if (energyLimit < BOOSTS.energyLimit.maxLevel) {
        const price = boostLevelPrice('energyLimit', energyLimit + 1);
        if (price <= cheap && price <= balance) {
          balance -= price;
          energyLimit++;
          continue;
        }
      }
      if (!card) return;
      const cost = coinCost(card);
      if (cost > balance) return;
      buy(card, t);
    }
  };

  const takeSnapshot = (day: number, t: number) => {
    const owned = CARDS.filter((c) => lvl.get(c.id)! > 0);
    const card = bestCard(t, day);
    const effHourly =
      (pph * (p.sessions.length * GAME.passive.maxOfflineHours)) / 24 +
      (dayIncome.taps + dayIncome.daily + dayIncome.other) / 24;
    const nextCost = card ? coinCost(card) : 0;
    const league = leagueForTotal(total);
    const perDay = Object.values(dayIncome).reduce((s, v) => s + v, 0);
    snapshots.push({
      day,
      balance,
      totalEarned: total,
      profitPerHour: pph,
      cardsOwned: owned.length,
      avgCardLevel: owned.length ? owned.reduce((s, c) => s + lvl.get(c.id)!, 0) / owned.length : 0,
      league,
      playerLevel: playerLevel(total).level,
      progress: overallProgress(lvl, total),
      nextBuyHours: card ? Math.max(0, nextCost - balance) / Math.max(1, effHourly) : 0,
      nextBuy: card ? `${card.id} ур.${lvl.get(card.id)! + 1}` : null,
      nextLeagueDays:
        league < LEAGUES.length - 1 && perDay > 0 ? (LEAGUES[league + 1]!.threshold - total) / perDay : null,
      availableUpgrades: CARDS.filter((c) => available(c, t, day)).length,
      starsSpent,
      income: { ...dayIncome },
    });
  };

  for (let day = 0; day < opts.days; day++) {
    const before = { ...income };
    const skip = p.missEveryNthDay > 0 && day % p.missEveryNthDay === p.missEveryNthDay - 1;
    if (!skip) {
      p.sessions.forEach((h, i) => session(day * DAY + h, day, i === 0));
    }
    missedYesterday = skip;
    if (skip) streak = 0;
    for (const k of Object.keys(dayIncome) as Array<keyof typeof income>)
      dayIncome[k] = income[k] - before[k];
    if (snapDays.has(day + 1)) takeSnapshot(day + 1, (day + 1) * DAY);
  }
  return snapshots;
}

/** День, когда общий прогресс впервые достигает share (null — не достиг за days). */
export function dayReaching(share: number, days: number, profile?: PlayerProfile): number | null {
  const marks = Array.from({ length: days }, (_, i) => i + 1);
  const snaps = simulate({ days, profile, snapshotDays: marks });
  return snaps.find((s) => s.progress.total >= share)?.day ?? null;
}

export { MAX_LEVEL };
