import { formatInt, type Achievement } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { BottomSheet } from '../../components/BottomSheet';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { useLocale, useT } from '../../i18n';

interface Props {
  achievement: Achievement | null;
  unlockedAt: number | null;
  value: number;
  onClose: () => void;
}

/** Подробности достижения: условие, награда, прогресс или дата получения. */
export function AchievementSheet({ achievement, unlockedAt, value, onClose }: Props) {
  const t = useT();
  const locale = useLocale();
  const a = achievement;
  const ratio = a ? Math.min(1, value / a.threshold) : 0;
  return (
    <BottomSheet open={Boolean(a)} onClose={onClose} testId="achievement-sheet">
      {a && (
        <div className="flex flex-col items-center px-5 pb-6 pt-2 text-center">
          <motion.div
            initial={{ scale: 0.7, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            className={unlockedAt ? 'drop-shadow-[0_0_24px_rgba(255,201,60,0.45)]' : ''}
          >
            <CardIcon icon={a.icon} size={96} muted={!unlockedAt} />
          </motion.div>
          <h3 className="mt-4 text-xl font-black">{a.name[locale]}</h3>
          <p className="mt-1 text-sm font-bold text-white/65">{a.desc[locale]}</p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-night-900/60 px-4 py-2">
            <span className="text-sm font-bold text-white/55">{t('achievements.reward')}</span>
            <CoinIcon size={20} />
            <span className="text-lg font-black">+{formatInt(a.reward)}</span>
          </div>
          {unlockedAt ? (
            <p className="mt-4 text-sm font-extrabold text-lime" data-testid="achievement-unlocked">
              ✓{' '}
              {t('achievements.unlocked', {
                date: new Date(unlockedAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US'),
              })}
            </p>
          ) : (
            <div className="mt-4 w-full" data-testid="achievement-progress">
              <div className="flex justify-between text-xs font-bold text-white/55">
                <span>{t('achievements.locked')}</span>
                <span className="tabular">
                  {t('achievements.progress', {
                    value: formatInt(Math.min(value, a.threshold)),
                    target: formatInt(a.threshold),
                  })}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full origin-left rounded-full bg-progress"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: ratio }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
