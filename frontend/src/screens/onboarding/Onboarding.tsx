import { formatInt, headquartersById, HQ_REWARD } from '@meowgul/shared';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { isReducedMotion } from '../../animations';
import { Button } from '../../components/Button';
import { CardIcon } from '../../components/cards/CardIcon';
import { CharacterImage } from '../../components/CharacterImage';
import { HqPicker } from '../../components/HqPicker';
import { CoinIcon } from '../../components/icons';
import { endpoints } from '../../api/endpoints';
import { runAction } from '../../game/actions';
import { centerOf, confetti, flyCoins } from '../../game/effects';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { useBlockingOverlay } from '../../store/overlays';

function TapVisual() {
  const reduced = isReducedMotion();
  return (
    <div className="relative">
      <motion.div
        className="h-48 w-48 overflow-hidden rounded-full shadow-[0_0_0_4px_#cd7f32,0_0_40px_rgba(205,127,50,0.5)]"
        animate={reduced ? undefined : { scale: [1, 0.94, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.5 }}
      >
        <CharacterImage size={192} className="h-full w-full" />
      </motion.div>
      {!reduced &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-6 text-3xl font-black text-white [text-shadow:0_2px_0_rgba(0,0,0,0.5)]"
            initial={{ opacity: 0, y: 0, x: -20 + i * 20 }}
            animate={{ opacity: [0, 1, 0], y: -60 }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.45, repeatDelay: 0.2 }}
          >
            +1
          </motion.span>
        ))}
    </div>
  );
}

function CardsVisual() {
  const t = useT();
  return (
    <div className="relative h-48 w-64">
      {[
        { icon: 'candles/none/0', rotate: -14, x: -70 },
        { icon: 'newspaper/LIVE/11', rotate: 0, x: 0 },
        { icon: 'id_card/KYC/5', rotate: 14, x: 70 },
      ].map((c, i) => (
        <motion.div
          key={c.icon}
          className="absolute left-1/2 top-6 -ml-12"
          initial={{ opacity: 0, y: 30, rotate: 0, x: 0 }}
          animate={{ opacity: 1, y: i === 1 ? -6 : 6, rotate: c.rotate, x: c.x }}
          transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 220, damping: 16 }}
        >
          <CardIcon icon={c.icon} size={96} />
        </motion.div>
      ))}
      <motion.span
        className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-night-700 px-3 py-1 text-sm font-black text-lime shadow-card"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45 }}
      >
        <CoinIcon size={16} />
        {t('card.perHourDelta', { value: '+198' })}
      </motion.span>
    </div>
  );
}

function FriendsVisual() {
  const bonus = useGame((s) => s.config?.referral.regular ?? 0);
  return (
    <div className="relative flex h-48 w-64 items-center justify-center gap-4">
      <motion.div
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: -6 }}
        transition={{ type: 'spring' }}
      >
        <CardIcon icon="people/heart/2" size={96} />
      </motion.div>
      <motion.div
        initial={{ scale: 0.5, rotate: 10 }}
        animate={{ scale: 1, rotate: 6 }}
        transition={{ type: 'spring', delay: 0.1 }}
      >
        <CardIcon icon="gift/star/6" size={96} />
      </motion.div>
      <motion.span
        className="absolute bottom-2 flex items-center gap-1 rounded-full bg-night-700 px-3 py-1 text-sm font-black text-gold shadow-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <CoinIcon size={16} />+{formatInt(bonus)}
      </motion.span>
    </div>
  );
}

const SLIDES: ReadonlyArray<{ title: MessageKey; text: MessageKey; visual: () => ReactNode }> = [
  { title: 'onboarding.tap.title', text: 'onboarding.tap.text', visual: () => <TapVisual /> },
  { title: 'onboarding.cards.title', text: 'onboarding.cards.text', visual: () => <CardsVisual /> },
  { title: 'onboarding.friends.title', text: 'onboarding.friends.text', visual: () => <FriendsVisual /> },
];

/** Первый вход: три слайда обучения и выбор штаб-квартиры (+5 000). */
export function Onboarding() {
  const t = useT();
  const locale = useLocale();
  const open = useGame((s) => s.onboarding);
  useBlockingOverlay(open);
  const finish = useGame((s) => s.finishOnboarding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [hqId, setHqId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onHq = step >= SLIDES.length;

  const go = (next: number) => {
    if (next < 0 || next > SLIDES.length) return;
    haptic.select();
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) go(step + 1);
    else if (info.offset.x > 60) go(step - 1);
  };

  const confirm = async (origin: HTMLElement) => {
    if (!hqId || busy) return;
    setBusy(true);
    const res = await runAction({ request: () => endpoints.chooseHq(hqId) });
    setBusy(false);
    if (!res) return;
    const point = centerOf(origin);
    haptic.notify('success');
    playSound('reward');
    confetti(point, 120);
    const name = headquartersById(hqId)?.name[locale] ?? '';
    toast.reward(t('hq.done', { name }));
    finish();
    // монеты летят в баланс уже открывшегося Офиса
    window.setTimeout(() => flyCoins(point, 16), 350);
  };

  const slide = SLIDES[step];
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="pt-safe pb-safe bg-space fixed inset-0 z-40 flex flex-col"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.3 }}
          data-testid="onboarding"
        >
          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-5 pb-4">
            <div className="flex h-12 items-center justify-end">
              {!onHq && (
                <button
                  type="button"
                  onClick={() => go(SLIDES.length)}
                  className="px-2 py-1 text-sm font-extrabold text-white/55"
                  data-testid="onboarding-skip"
                >
                  {t('onboarding.skip')}
                </button>
              )}
            </div>

            {slide ? (
              <>
                <motion.div
                  className="flex min-h-0 flex-1 touch-pan-y flex-col items-center justify-center text-center"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={onDragEnd}
                >
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={step}
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, x: direction * 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: direction * -60 }}
                      transition={{ duration: 0.25 }}
                      data-testid={`onboarding-slide-${step}`}
                    >
                      {slide.visual()}
                      <h1 className="mt-8 text-[28px] font-black leading-tight">{t(slide.title)}</h1>
                      <p className="mt-3 max-w-[320px] text-[15px] font-semibold leading-snug text-white/65">
                        {t(slide.text)}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
                <div className="mb-4 flex justify-center gap-2" aria-hidden>
                  {SLIDES.map((_, i) => (
                    <motion.span
                      key={i}
                      className="h-2 rounded-full bg-white/25"
                      animate={{
                        width: i === step ? 24 : 8,
                        backgroundColor: i === step ? '#ffc93c' : 'rgba(255,255,255,0.25)',
                      }}
                    />
                  ))}
                </div>
                <Button
                  block
                  className="h-14 text-base"
                  onClick={() => go(step + 1)}
                  data-testid="onboarding-next"
                >
                  {step === SLIDES.length - 1 ? t('onboarding.toHq') : t('onboarding.next')}
                </Button>
              </>
            ) : (
              <motion.div
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="onboarding-hq"
              >
                <h1 className="text-center text-[26px] font-black leading-tight">{t('hq.title')}</h1>
                <p className="mx-auto mt-2 max-w-[320px] text-center text-sm font-semibold leading-snug text-white/65">
                  {t('hq.text')}
                </p>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">
                  <HqPicker value={hqId} onChange={setHqId} />
                </div>
                <Button
                  block
                  className="mt-3 h-14 text-base"
                  disabled={!hqId}
                  loading={busy}
                  onClick={(e) => void confirm(e.currentTarget)}
                  data-testid="hq-confirm"
                >
                  {t('hq.confirm', { reward: formatInt(HQ_REWARD) })}
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
