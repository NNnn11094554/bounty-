import { formatInt } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { isReducedMotion } from '../animations';
import { confetti, flyCoins } from '../game/effects';
import { useT } from '../i18n';
import { playSound } from '../lib/sound';
import { useDailyGames } from '../store/dailyGames';
import { haptic } from '../telegram/webapp';
import { useBlockingOverlay } from '../store/overlays';

/** «Комбо собрано!»: фейерверк и +5 000 000 на весь экран. Закрывается сама или по нажатию. */
export function ComboCelebration() {
  const t = useT();
  const reward = useDailyGames((s) => s.celebrate);
  const dismiss = useDailyGames((s) => s.dismissCelebration);
  useBlockingOverlay(reward !== null);

  useEffect(() => {
    if (reward === null) return;
    playSound('league');
    haptic.notify('success');
    const w = window.innerWidth;
    const h = window.innerHeight;
    confetti({ x: w / 2, y: h * 0.45 }, 160);
    const bursts = isReducedMotion()
      ? []
      : [
          window.setTimeout(() => confetti({ x: w * 0.25, y: h * 0.35 }, 90), 350),
          window.setTimeout(() => confetti({ x: w * 0.75, y: h * 0.3 }, 90), 700),
        ];
    const coins = window.setTimeout(() => flyCoins({ x: w / 2, y: h * 0.45 }, 20), 900);
    const close = window.setTimeout(dismiss, 2800);
    return () => {
      bursts.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(coins);
      window.clearTimeout(close);
    };
  }, [reward, dismiss]);

  return createPortal(
    <AnimatePresence>
      {reward !== null && (
        <motion.div
          className="fixed inset-0 z-[55] flex flex-col items-center justify-center bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismiss}
          data-testid="combo-celebration"
        >
          <motion.p
            className="text-lg font-black uppercase tracking-[0.2em] text-white/80"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t('combo.celebrate')}
          </motion.p>
          <motion.p
            className="mt-3 text-[44px] font-black text-gold [text-shadow:0_0_30px_rgba(255,201,60,0.7)]"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: [0.3, 1.2, 1], opacity: 1 }}
            transition={{ duration: 0.7, times: [0, 0.6, 1] }}
          >
            +{formatInt(reward)}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
