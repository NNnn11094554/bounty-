import { formatShort, type CardView } from '@meowgul/shared';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { memo, useEffect } from 'react';
import { CardArt, CardIcon } from '../../components/cards/CardIcon';
import { CooldownRing } from '../../components/CooldownRing';
import { CoinIcon } from '../../components/icons';
import { tapEngine } from '../../game/tapEngine';
import { useAffordable } from '../../hooks/useAffordable';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT } from '../../i18n';
import { useCards } from '../../store/cards';
import { limitedText, lockText } from './cardText';

function LockBadge({ size = 22 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full bg-night-900/80 text-white shadow-card"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" aria-hidden>
        <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.6" />
        <rect x="5" y="10.5" width="14" height="10.5" rx="2.4" fill="currentColor" />
      </svg>
    </span>
  );
}

function LimitedPill({ card }: { card: CardView }) {
  const locale = useLocale();
  const now = useNow(1000);
  const text = limitedText(locale, card, now + (tapEngine.serverNow() - Date.now()));
  if (!text) return null;
  return (
    <span
      className="absolute left-1.5 top-1.5 z-10 rounded-full bg-night-900/80 px-2 py-0.5 text-[10px] font-black tabular text-gold shadow-card"
      data-testid="limited-timer"
    >
      ⏱ {text}
    </span>
  );
}

/** Нижняя строка плитки: уровень | цена, условие открытия или MAX. */
function Footer({ card, affordable }: { card: CardView; affordable: boolean }) {
  const t = useT();
  const locale = useLocale();
  if (card.lock) {
    return (
      <p className="line-clamp-2 text-[11px] font-bold leading-tight text-white/60" data-testid="card-lock">
        {lockText(locale, card.lock, true)}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs font-extrabold">
      <span className="relative h-4 w-11 shrink-0 overflow-hidden text-white/80 [perspective:200px]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={card.level}
            className="absolute inset-0"
            initial={{ rotateX: -90, y: 8, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, opacity: 1 }}
            exit={{ rotateX: 90, y: -8, opacity: 0 }}
            transition={{ duration: 0.35 }}
            data-testid="card-level"
          >
            {t('card.lvl', { n: card.level })}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="h-4 w-px bg-white/15" />
      {card.nextPrice === null ? (
        <span className="text-gold">{t('card.max')}</span>
      ) : (
        <span
          className={`flex min-w-0 items-center gap-1 ${affordable && card.available ? '' : 'text-white/40'}`}
          data-testid="card-price"
        >
          <CoinIcon size={14} className={affordable && card.available ? '' : 'opacity-50 grayscale'} />
          {formatShort(card.nextPrice, locale)}
        </span>
      )}
    </div>
  );
}

function ProfitLine({ card }: { card: CardView }) {
  const t = useT();
  const locale = useLocale();
  const value = card.nextProfit ?? card.profitPerHour;
  return (
    <div className="leading-tight">
      <p className="text-[10px] font-bold text-white/50">{t('card.perHour')}</p>
      <p className="flex items-center gap-1 text-xs font-extrabold" data-testid="card-profit">
        <CoinIcon size={13} />+{formatShort(value, locale)}
      </p>
    </div>
  );
}

interface Props {
  card: CardView;
  onOpen: (card: CardView) => void;
}

/** Плитка карточки в сетке Mine. У Specials — иллюстрация сверху. */
export const CardTile = memo(function CardTile({ card, onOpen }: Props) {
  const affordable = useAffordable(card.nextPrice);
  const controls = useAnimationControls();
  const lastUpgrade = useCards((s) => s.lastUpgrade);
  const special = card.category === 'SPECIALS';
  const muted = Boolean(card.lock) || !card.available;
  const cooling = card.cooldownUntil !== null;

  useEffect(() => {
    if (lastUpgrade?.id !== card.id || Date.now() - lastUpgrade.at > 1500) return;
    void controls.start({ scale: [1, 1.08, 0.97, 1], transition: { duration: 0.5 } });
  }, [lastUpgrade, card.id, controls]);

  const name = <CardName card={card} />;

  return (
    <motion.button
      type="button"
      animate={controls}
      whileTap={{ scale: 0.96 }}
      onClick={() => onOpen(card)}
      className="relative flex w-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-night-700 text-left shadow-card"
      data-testid={`card-${card.id}`}
      data-locked={card.lock ? 'true' : undefined}
    >
      {special ? (
        <>
          <div className="relative aspect-[16/10] w-full">
            <CardArt
              icon={card.icon}
              seed={card.id}
              muted={muted}
              className="absolute inset-0 h-full w-full"
            />
            {card.limited && <LimitedPill card={card} />}
            {card.lock && (
              <span className="absolute inset-0 grid place-items-center bg-night-900/30">
                <LockBadge size={30} />
              </span>
            )}
            {cooling && card.cooldownUntil && (
              <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2">
                <CooldownRing until={card.cooldownUntil} totalSec={card.cooldownSec} size={56} />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1.5 p-2.5">
            {name}
            <ProfitLine card={card} />
            <div className="mt-auto border-t border-white/10 pt-2">
              <Footer card={card} affordable={affordable} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col p-2.5">
          <div className="flex items-start gap-2.5">
            <div className="relative h-[52px] w-[52px] shrink-0">
              <CardIcon icon={card.icon} size={52} muted={muted} />
              {card.lock && (
                <span className="absolute -bottom-1 -right-1">
                  <LockBadge />
                </span>
              )}
              {cooling && card.cooldownUntil && (
                <CooldownRing until={card.cooldownUntil} totalSec={card.cooldownSec} size={52} />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {name}
              <ProfitLine card={card} />
            </div>
          </div>
          <div className="mt-auto border-t border-white/10 pt-2">
            <Footer card={card} affordable={affordable} />
          </div>
        </div>
      )}
    </motion.button>
  );
});

function CardName({ card }: { card: CardView }) {
  const locale = useLocale();
  return (
    <p
      lang={locale}
      className="line-clamp-2 min-h-[2.4em] hyphens-auto text-[13px] font-extrabold leading-[1.2] [overflow-wrap:anywhere]"
      data-testid="card-name"
    >
      {card.name[locale]}
    </p>
  );
}

/** Заглушка плитки на время загрузки. */
export function CardTileSkeleton({ special }: { special?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-night-700 shadow-card">
      {special && <div className="skeleton aspect-[16/10] w-full" />}
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex gap-2.5">
          {!special && <div className="skeleton h-[52px] w-[52px] rounded-[14px]" />}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="skeleton h-3 w-4/5 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
        <div className="skeleton h-3.5 w-full rounded" />
      </div>
    </div>
  );
}
