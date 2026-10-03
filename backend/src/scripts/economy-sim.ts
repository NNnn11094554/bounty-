/**
 * Симуляция прогресса обычного активного игрока: npm run economy-sim [-- --days=N]
 * Таблица по контрольным дням и день, когда общий прогресс достигает 20/50/70/80/90/100%.
 */
import { formatShort } from '@meowgul/shared';
import { NORMAL_PLAYER, simulate, type PlayerProfile } from '../game/economy/simulate.js';

process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const f = (n: number) => formatShort(Math.round(n), 'ru');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const hours = (h: number) =>
  h < 1 ? `${Math.round(h * 60)} мин` : h < 48 ? `${h.toFixed(1)} ч` : `${(h / 24).toFixed(1)} дн`;

function report(name: string, profile: PlayerProfile, days: number): void {
  const CHECK = [
    1, 3, 7, 14, 21, 30, 60, 90, 120, 150, 180, 210, 270, 365, 545, 730, 1095, 1460, 1825,
  ].filter((d) => d <= days);
  const all = Array.from({ length: days }, (_, i) => i + 1);
  const snaps = simulate({ days, profile, snapshotDays: all });
  console.log(`\n=== ${name} ===`);
  console.log(
    'день | прогресс (карточки/лига/уровень) | баланс | доход/ч | карт | ср.ур | лига | ур.игрока | доход за день (пассив/тапы/ежедн./прочее) | след. покупка | до лиги',
  );
  for (const s of snaps.filter((x) => CHECK.includes(x.day))) {
    const i = s.income;
    console.log(
      [
        String(s.day).padStart(4),
        `${pct(s.progress.total)} (${pct(s.progress.cards)}/${pct(s.progress.league)}/${pct(s.progress.level)})`,
        f(s.balance),
        f(s.profitPerHour),
        s.cardsOwned,
        s.avgCardLevel.toFixed(1),
        s.league,
        s.playerLevel,
        `${f(i.passive)}/${f(i.taps)}/${f(i.daily)}/${f(i.other)}`,
        `${s.nextBuy ?? '—'} через ${hours(s.nextBuyHours)}`,
        s.nextLeagueDays === null ? '—' : `${s.nextLeagueDays.toFixed(1)} дн`,
      ].join(' | '),
    );
  }
  for (const share of [0.2, 0.5, 0.7, 0.8, 0.9, 1]) {
    const hit = snaps.find((s) => s.progress.total >= share - 1e-9);
    console.log(
      `  ${Math.round(share * 100)}% — ${hit ? `день ${hit.day} (${(hit.day / 30.4).toFixed(1)} мес)` : `не достигнут за ${days} дн`}`,
    );
  }
}

const days = Number(process.argv.find((a) => a.startsWith('--days='))?.slice(7) ?? 730);
report('обычный активный игрок', NORMAL_PLAYER, days);
if (process.argv.includes('--solo')) report('без друзей', { ...NORMAL_PLAYER, friends: [] }, days);
