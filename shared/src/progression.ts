/**
 * Уровень игрока (1…50) — по монетам, заработанным за всё время (то же число, что двигает лиги).
 * Уровни не дают монет и не меняют экономику: открывают скины и эффекты в коллекции.
 * Пороги — по опорным точкам долгой прогрессии (между ними — плавно, в логарифмической шкале):
 * обычный активный игрок берёт ~5 уровень в первый день, ~22 за месяц, ~40 за 7 месяцев,
 * а последние уровни — долгий эндгейм (см. npm run economy-sim в backend).
 */
export const MAX_LEVEL = 50;

const LEVEL_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [2, 20_000],
  [5, 350_000],
  [8, 2_400_000],
  [12, 15_000_000],
  [16, 130_000_000],
  [22, 1_500_000_000],
  [28, 15_000_000_000],
  [31, 50_000_000_000],
  [34, 120_000_000_000],
  [36, 200_000_000_000],
  [38, 320_000_000_000],
  [40, 450_000_000_000],
  [42, 750_000_000_000],
  [44, 1_300_000_000_000],
  [47, 2_600_000_000_000],
  [49, 4_000_000_000_000],
  [50, 6_000_000_000_000],
];

/** Две значащие цифры — пороги читаются глазами (1,5 млрд, 320 млрд). */
function round2(n: number): number {
  const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
}

export function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  const top = Math.min(level, MAX_LEVEL);
  for (let i = 0; i < LEVEL_ANCHORS.length; i++) {
    const [l1, v1] = LEVEL_ANCHORS[i]!;
    if (top === l1) return v1;
    const next = LEVEL_ANCHORS[i + 1];
    if (next && top > l1 && top < next[0]) {
      const t = (top - l1) / (next[0] - l1);
      return round2(Math.exp(Math.log(v1) + t * (Math.log(next[1]) - Math.log(v1))));
    }
  }
  return LEVEL_ANCHORS[LEVEL_ANCHORS.length - 1]![1];
}

export interface LevelInfo {
  level: number;
  /** заработано с начала текущего уровня */
  current: number;
  /** нужно заработать на этом уровне до следующего (0 — максимальный) */
  span: number;
  /** 0…1 */
  progress: number;
}

export function playerLevel(totalEarned: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && totalEarned >= levelThreshold(level + 1)) level++;
  const from = levelThreshold(level);
  const span = level >= MAX_LEVEL ? 0 : levelThreshold(level + 1) - from;
  const current = Math.max(0, totalEarned - from);
  return { level, current, span, progress: span ? Math.min(1, current / span) : 1 };
}
