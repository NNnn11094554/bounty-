import { formatDuration, formatInt, type ComboCard } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { isReducedMotion } from '../../animations';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT } from '../../i18n';
import { useDailyGames } from '../../store/dailyGames';

function Slot({ card, index, fresh }: { card: ComboCard | null; index: number; fresh: boolean }) {
  const locale = useLocale();
  const reduced = isReducedMotion();
  return (
    <div
      className="relative h-14 w-14 shrink-0 [perspective:400px] narrow:h-11 narrow:w-11"
      data-testid={`combo-slot-${index}`}
    >
      <motion.div
        key={card?.id ?? 'empty'}
        className="absolute inset-0"
        initial={fresh && !reduced ? { rotateY: 180, scale: 0.8 } : false}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {card ? (
          <div
            className="h-full w-full rounded-[16px] shadow-[0_0_18px_rgba(255,201,60,0.55)] ring-2 ring-gold"
            title={card.name[locale]}
            data-card={card.id}
          >
            <CardIcon icon={card.icon} size={56} className="h-full w-full" />
          </div>
        ) : (
          <div className="grid h-full w-full place-items-center rounded-[16px] border-2 border-dashed border-white/20 bg-night-600 text-2xl font-black text-white/40">
            ?
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** Комбо дня на Mine: 3 слота угаданных карточек, награда и таймер до сброса. */
export function ComboPanel() {
  const t = useT();
  const combo = useDailyGames((s) => s.combo);
  const revealed = useDailyGames((s) => s.revealed);
  const nextResetAt = useDailyGames((s) => s.nextResetAt);
  const load = useDailyGames((s) => s.load);
  const now = useNow(1000);
  const serverNow = now + (tapEngine.serverNow() - Date.now());

  useEffect(() => {
    void load();
  }, [load]);
  // новый игровой день — новое комбо
  useEffect(() => {
    if (nextResetAt && serverNow >= nextResetAt) void load(true);
  }, [serverNow, nextResetAt, load]);

  if (!combo) {
    return <div className="skeleton mx-4 mt-3 h-[76px] rounded-[20px]" data-testid="combo-skeleton" />;
  }
  return (
    <div
      className="mx-4 mt-3 flex items-center gap-3 rounded-[20px] border border-line bg-night-700/90 px-3 py-2.5 shadow-card"
      data-testid="combo"
    >
      <div className="min-w-0 flex-1">
        <p className="whitespace-nowrap text-[15px] font-black">{t('combo.title')}</p>
        {combo.rewarded ? (
          <p className="text-xs font-extrabold text-lime" data-testid="combo-done">
            ✓ {t('combo.done')}
          </p>
        ) : (
          <p className="flex items-center gap-1 whitespace-nowrap text-xs font-extrabold text-gold">
            <CoinIcon size={14} className="shrink-0" />+{formatInt(combo.reward)}
          </p>
        )}
        <p className="mt-0.5 truncate text-[11px] font-bold tabular text-white/45">
          {t('combo.resetIn', { time: formatDuration(Math.max(0, nextResetAt - serverNow) / 1000) })}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5 narrow:gap-1">
        {combo.slots.map((card, i) => (
          <Slot key={i} card={card} index={i} fresh={card !== null && card.id === revealed} />
        ))}
      </div>
    </div>
  );
}
