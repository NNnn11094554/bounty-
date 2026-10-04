import { formatDuration, formatInt, formatShort } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { DURATION, isReducedMotion } from '../../animations';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { claimDaily } from '../../game/earn';
import { centerOf, flyCoins } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { plural, useLocale, useT } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { useBusy } from '../../hooks/useBusy';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Ежедневная награда: 10 плиток дней, сегодняшняя пульсирует, при сборе — переворот и монеты в баланс. */
export function DailyRewardSheet({ open, onClose }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} testId="daily-sheet">
      {open && <DailyBody />}
    </BottomSheet>
  );
}

function DailyBody() {
  const t = useT();
  const locale = useLocale();
  const daily = useGame((s) => s.player?.daily);
  const rewards = useGame((s) => s.config?.dailyRewards ?? []);
  const nextReset = useGame((s) => s.player?.nextResetAt ?? 0);
  const now = useNow(1000);
  const [busy, run] = useBusy();
  const [flipped, setFlipped] = useState<number | null>(null);
  const tiles = useRef<Array<HTMLDivElement | null>>([]);
  const reduced = isReducedMotion();
  if (!daily) return null;

  // забранные дни цикла: сегодняшний (если забран) и все до него в текущей серии
  const claimedUpTo = daily.claimedToday ? daily.day : daily.day - 1;
  const serverNow = now + (tapEngine.serverNow() - Date.now());

  const claim = () =>
    run(async () => {
      if (daily.claimedToday) return;
      const day = daily.day;
      const res = await claimDaily();
      if (!res) return;
      setFlipped(day);
      haptic.notify('success');
      playSound('reward');
      flyCoins(centerOf(tiles.current[day - 1] ?? null), 16);
      toast.success(t('daily.claimed', { n: day, reward: formatInt(res.reward) }));
    });

  return (
    <div className="flex flex-col items-center gap-3 pt-1 text-center">
      <motion.div
        initial={{ scale: 0.5, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 14 }}
        className="rounded-full shadow-glow"
      >
        <CoinIcon size={72} />
      </motion.div>
      <h3 className="text-2xl font-black">{t('daily.title')}</h3>
      <p className="max-w-[320px] text-sm font-semibold leading-snug text-white/65">{t('daily.text')}</p>
      {daily.streakBroken && !daily.claimedToday && (
        <p
          className="rounded-2xl border border-coral-from/40 bg-coral-from/10 px-3 py-2 text-xs font-bold text-coral-from"
          data-testid="daily-broken"
        >
          {t('daily.broken')}
        </p>
      )}
      <div className="grid w-full grid-cols-4 gap-2 [perspective:600px]" data-testid="daily-grid">
        {rewards.map((reward, i) => {
          const day = i + 1;
          const claimed = day <= claimedUpTo;
          const today = day === daily.day && !daily.claimedToday;
          return (
            <motion.div
              key={day}
              ref={(el) => {
                tiles.current[i] = el;
              }}
              initial={reduced ? false : { opacity: 0, y: 14, scale: 0.9 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: today && !reduced ? [1, 1.06, 1] : 1,
                rotateY: flipped === day && !reduced ? [0, 180, 360] : 0,
              }}
              transition={{
                delay: (i * DURATION.stagger) / 1000,
                scale: today ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined,
                rotateY: { duration: 0.7 },
              }}
              className={`flex flex-col items-center gap-0.5 rounded-2xl border px-1 py-2 ${
                claimed
                  ? 'border-lime/50 bg-gradient-to-b from-lime/80 to-[#15924a] text-white'
                  : today
                    ? 'border-gold/70 bg-night-600 shadow-glow'
                    : 'border-line bg-night-600/60 text-white/45'
              }`}
              data-testid={`daily-day-${day}`}
              data-state={claimed ? 'claimed' : today ? 'today' : 'future'}
            >
              <span className="text-[11px] font-extrabold">{t('daily.day', { n: day })}</span>
              <CoinIcon size={22} className={claimed || today ? '' : 'opacity-60 grayscale'} />
              <span className="text-[13px] font-black">{formatShort(reward, locale)}</span>
            </motion.div>
          );
        })}
      </div>
      {daily.streak > 0 && (
        <p className="text-xs font-bold text-white/50" data-testid="daily-streak">
          {t('daily.streak', {
            n: daily.streak,
            days: plural(locale, daily.streak, {
              one: t('daily.day.one'),
              few: t('daily.day.few'),
              many: t('daily.day.many'),
            }),
          })}
        </p>
      )}
      <Button
        block
        className="mt-1 h-14 text-base"
        disabled={daily.claimedToday}
        loading={busy}
        onClick={() => void claim()}
        data-testid="daily-claim"
      >
        {daily.claimedToday ? t('daily.tomorrow') : t('daily.claim')}
      </Button>
      {daily.claimedToday && (
        <p className="text-xs font-bold tabular text-white/45">
          {t('daily.nextIn', { time: formatDuration((nextReset - serverNow) / 1000) })}
        </p>
      )}
    </div>
  );
}
