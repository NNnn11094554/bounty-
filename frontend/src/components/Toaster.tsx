import { AnimatePresence, motion } from 'framer-motion';
import { useToasts, type ToastKind } from '../store/toasts';
import { CoinIcon } from './icons';

const STYLE: Record<ToastKind, string> = {
  info: 'bg-night-600/95 text-white',
  success: 'bg-[#16352a]/95 text-lime',
  error: 'bg-[#3a1620]/95 text-[#ff8c95]',
  reward: 'bg-night-600/95 text-gold',
  network: 'bg-[#3a2a12]/95 text-gold',
};

/** Тосты сверху экрана: покупки, ошибки, награды, «нет соединения». */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-3">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            type="button"
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex max-w-[360px] items-center gap-2 rounded-2xl border border-line px-4 py-2.5 text-sm font-bold shadow-card ${STYLE[t.kind]}`}
            data-testid={`toast-${t.kind}`}
          >
            {t.kind === 'reward' && <CoinIcon size={18} />}
            {t.kind === 'network' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
            )}
            <span>{t.text}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
