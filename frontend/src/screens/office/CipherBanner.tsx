import { formatInt, MORSE } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { enterCipher, eraseLetter, exitCipher, useCipherInput } from '../../game/cipher';
import { useLocale, useT } from '../../i18n';
import { useDailyGames } from '../../store/dailyGames';

function IconButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: string;
  testId: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black text-white/80"
      data-testid={testId}
    >
      {children}
    </motion.button>
  );
}

/** Шпаргалка азбуки Морзе. */
function MorseHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <BottomSheet open={open} onClose={onClose} testId="morse-help">
      <div className="flex flex-col gap-3 pt-1">
        <h3 className="text-xl font-black">{t('cipher.helpTitle')}</h3>
        <p className="text-sm font-semibold leading-snug text-white/70">{t('cipher.helpText')}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(MORSE).map(([letter, code]) => (
            <div key={letter} className="flex items-center gap-1.5 rounded-xl bg-night-600 px-2 py-1.5">
              <span className="w-4 text-sm font-black">{letter}</span>
              <span className="font-mono text-sm font-black tracking-wider text-gold">
                {code.replaceAll('.', '•').replaceAll('-', '−')}
              </span>
            </div>
          ))}
        </div>
        <Button block className="mt-1" onClick={onClose}>
          {t('common.ok')}
        </Button>
      </div>
    </BottomSheet>
  );
}

/** Плашка шифра дня на Офисе: награда, вход в режим ввода, слоты букв и подсказка. */
export function CipherBanner() {
  const t = useT();
  const locale = useLocale();
  const cipher = useDailyGames((s) => s.cipher);
  const failed = useDailyGames((s) => s.status === 'error');
  const load = useDailyGames((s) => s.load);
  const active = useCipherInput((s) => s.active);
  const letters = useCipherInput((s) => s.letters);
  const shake = useCipherInput((s) => s.shake);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);
  // уходя с Офиса, выходим из режима шифра
  useEffect(() => exitCipher, []);

  // пока шифр не введён — компактная плашка в свободном углу над котом, чтобы кот был крупнее
  const chip =
    'absolute left-0 top-1 z-10 flex w-[88px] flex-col items-start gap-0.5 rounded-2xl border px-2.5 py-2 text-left shadow-card';
  if (!cipher) {
    if (failed) return null;
    return (
      <div className="relative h-0" aria-hidden>
        <div className={`${chip} border-line bg-night-700/90`} data-testid="cipher-skeleton">
          <span className="font-mono text-sm font-black leading-none text-gold/40">•−</span>
          <span className="skeleton mt-1 h-3 w-14 rounded" />
          <span className="skeleton h-3 w-16 rounded" />
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="relative h-0" data-testid="cipher-banner">
        {cipher.solved ? (
          <div className={`${chip} border-line bg-night-700/80`} data-testid="cipher-solved">
            <span className="text-[11px] font-extrabold leading-tight text-white/70">
              {t('cipher.title')}
            </span>
            <span className="text-sm font-black text-lime">✓ {t('cipher.solved')}</span>
          </div>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={enterCipher}
            className={`${chip} cipher-chip border-gold/40 bg-night-700/95`}
            aria-label={`${t('cipher.title')}: ${t('cipher.enter')}`}
            data-testid="cipher-enter"
          >
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-sm font-black leading-none text-gold">•−</span>
              <span className="text-[11px] font-extrabold leading-tight text-white/85">
                {t('cipher.short')}
              </span>
            </span>
            <span className="flex items-center gap-0.5 whitespace-nowrap text-[11px] font-black text-gold">
              <CoinIcon size={11} />+{formatInt(cipher.reward)}
            </span>
            <span className="mt-0.5 w-full rounded-lg bg-cta py-0.5 text-center text-[11px] font-extrabold shadow-button">
              {t('cipher.enter')}
            </span>
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-3 rounded-2xl border border-gold/40 bg-night-700/95 px-3 py-2 shadow-glow short:mt-2 short:py-1.5"
      data-testid="cipher-banner"
      data-active="true"
    >
      <div className="flex items-center gap-2">
        <p
          className="line-clamp-2 min-w-0 flex-1 text-xs font-bold leading-snug text-white/70"
          data-testid="cipher-hint"
        >
          {cipher.hint[locale]}
        </p>
        <IconButton label={t('cipher.help')} onClick={() => setHelp(true)} testId="cipher-help">
          ?
        </IconButton>
        <IconButton label={t('cipher.erase')} onClick={eraseLetter} testId="cipher-erase">
          ⌫
        </IconButton>
        <IconButton label={t('cipher.exit')} onClick={exitCipher} testId="cipher-exit">
          ✕
        </IconButton>
      </div>
      <motion.div
        key={shake}
        className="mt-2 flex justify-center gap-1.5"
        animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
        transition={{ duration: 0.4 }}
        data-testid="cipher-letters"
      >
        {Array.from({ length: cipher.length }, (_, i) => (
          <span
            key={i}
            className={`grid h-9 w-8 place-items-center rounded-lg border-2 text-lg font-black ${
              letters[i] ? 'border-lime bg-lime/15 text-lime' : 'border-white/15 bg-night-600 text-white/30'
            }`}
          >
            <AnimatePresence mode="popLayout">
              {letters[i] && (
                <motion.span
                  key={letters[i]}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.3, opacity: 0 }}
                >
                  {letters[i]}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        ))}
      </motion.div>
      <MorseHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

/** Над котом: вводимые точки и тире и вспышка распознанной буквы. */
export function MorseOverlay() {
  const t = useT();
  const code = useCipherInput((s) => s.code);
  const flash = useCipherInput((s) => s.flash);
  const [visibleFlash, setVisibleFlash] = useState<typeof flash>(null);
  useEffect(() => {
    if (!flash) return;
    setVisibleFlash(flash);
    const id = window.setTimeout(() => setVisibleFlash(null), 800);
    return () => window.clearTimeout(id);
  }, [flash]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex h-11 items-center justify-center"
      data-testid="morse-overlay"
    >
      <AnimatePresence mode="popLayout">
        {code ? (
          <motion.div key="code" className="flex items-center gap-2" exit={{ opacity: 0, scale: 0.8 }}>
            {[...code].map((symbol, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`block rounded-full bg-gold shadow-glow ${symbol === '.' ? 'h-3.5 w-3.5' : 'h-3.5 w-10'}`}
                data-symbol={symbol}
              />
            ))}
          </motion.div>
        ) : visibleFlash ? (
          <motion.span
            key={visibleFlash.at}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-3xl font-black ${visibleFlash.ok ? 'text-lime' : 'text-coral-to'}`}
            data-testid="morse-flash"
          >
            {visibleFlash.ok ? visibleFlash.letter : t('cipher.badLetter')}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
