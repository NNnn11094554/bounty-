import { formatDuration, formatInt } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { centerOf, flyCoins } from '../game/effects';
import { useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useGame } from '../store/game';
import { haptic } from '../telegram/webapp';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { CoinIcon } from './icons';

/** «Пока вас не было, ваша компания заработала +123 456» — при входе после отсутствия. */
export function OfflineIncomeSheet() {
  const t = useT();
  const offline = useGame((s) => s.offline);
  const status = useGame((s) => s.status);
  const maxHours = useGame((s) => s.config?.passive.maxOfflineHours ?? 3);
  const dismiss = useGame((s) => s.dismissOffline);
  const coinRef = useRef<HTMLDivElement>(null);
  const open = status === 'ready' && offline !== null && offline.earned >= 1;

  const thanks = () => {
    flyCoins(centerOf(coinRef.current), 16);
    playSound('reward');
    haptic.notify('success');
    dismiss();
  };

  return (
    <BottomSheet open={open} onClose={thanks} testId="offline-sheet">
      {offline && (
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <motion.div
            ref={coinRef}
            initial={{ scale: 0.4, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 12 }}
            className="rounded-full shadow-glow"
          >
            <CoinIcon size={84} />
          </motion.div>
          <h3 className="mt-2 text-xl font-black">{t('offline.title')}</h3>
          <p className="text-[15px] font-semibold text-white/70">{t('offline.text')}</p>
          <p className="text-[34px] font-black tabular text-gold" data-testid="offline-amount">
            +{formatInt(Math.floor(offline.earned))}
          </p>
          <p className="text-xs font-bold text-white/45">
            {t('offline.away', { time: formatDuration(offline.seconds) })}
          </p>
          {offline.seconds > maxHours * 3600 && (
            <p className="max-w-[300px] text-xs font-bold text-coral-from">
              {t('offline.cap', { hours: maxHours })}
            </p>
          )}
          <Button block className="mt-3 h-14 text-base" onClick={thanks} data-testid="offline-thanks">
            {t('common.thanks')}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
