import { formatDuration, formatShort, type CardView } from '@meowgul/shared';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CardArt, CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon, StarIcon } from '../../components/icons';
import { catMood } from '../../game/catMood';
import { cardBlock, cardPaybackHours, unlockAsset, upgradeCard } from '../../game/cards';
import { centerOf, confetti } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useAffordable } from '../../hooks/useAffordable';
import { useNow } from '../../hooks/useNow';
import { useBusy } from '../../hooks/useBusy';
import { useLocale, useT } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useNav } from '../../store/nav';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { limitedText, lockText } from './cardText';
import { RARITY_COLOR } from './rarity';

interface Props {
  card: CardView | null;
  onClose: () => void;
}

/**
 * Шторка актива: описание, редкость, текущий уровень и доход, следующий уровень, цена улучшения,
 * доход после улучшения и окупаемость; кнопка «Улучшить» (монеты) или «Открыть за ⭐» (Stars).
 */
export function CardSheet({ card, onClose }: Props) {
  return (
    <BottomSheet open={card !== null} onClose={onClose} testId="card-sheet">
      {card && <CardSheetBody card={card} onClose={onClose} />}
    </BottomSheet>
  );
}

function Stat({
  label,
  value,
  testId,
  accent,
}: {
  label: string;
  value: ReactNode;
  testId: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-start gap-0.5 rounded-2xl bg-night-600/70 px-3 py-2 text-left"
      data-testid={testId}
    >
      <span className="text-[11px] font-bold text-white/50">{label}</span>
      <span className={`flex items-center gap-1 text-[15px] font-black tabular ${accent ? 'text-lime' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function CardSheetBody({ card, onClose }: { card: CardView; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(1000);
  const [busy, run] = useBusy();
  // перерисовка, когда монет становится достаточно (пассивный доход капает)
  useAffordable(card.nextPrice);
  const serverNow = now + (tapEngine.serverNow() - Date.now());
  const block = cardBlock(card, tapEngine.balanceNow(), serverNow);
  const special = card.category === 'SPECIALS';
  const limited = limitedText(locale, card, serverNow);
  const stars = block?.kind === 'stars' ? block.stars : null;
  const payback = cardPaybackHours(card);
  const rarity = RARITY_COLOR[card.rarity];

  const blockText = (): string | null => {
    if (!block) return null;
    switch (block.kind) {
      case 'max':
        return t('card.maxLevel');
      case 'unavailable':
        return card.limited ? t('card.limited.over') : t('card.unavailable');
      case 'locked':
        return card.lock ? lockText(locale, card.lock) : t('action.error.locked');
      case 'stars':
        return null;
      case 'cooldown':
        return t('card.cooldown', { time: formatDuration((block.until - serverNow) / 1000) });
      case 'funds':
        return t('card.notEnough');
    }
  };

  // двойной тап по «Купить» не покупает уровень дважды
  const buy = (origin: HTMLElement) =>
    run(async () => {
      if (block) return;
      const res = await upgradeCard(card);
      if (!res) return;
      haptic.notify('success');
      playSound('purchase');
      confetti(centerOf(origin));
      const level = res.cards.find((c) => c.id === card.id)?.level ?? card.level + 1;
      toast.success(t('card.bought', { name: card.name[locale], n: level }));
      if (res.combo && res.combo.reward === 0) toast.success(t('combo.found'));
      onClose();
    });

  const unlock = (origin: HTMLElement) =>
    run(async () => {
      if (stars === null) return;
      haptic.impact('light');
      const result = await unlockAsset(card);
      if (result === 'paid') {
        haptic.notify('success');
        playSound('reward');
        catMood.emit('purchase');
        confetti(centerOf(origin), 60);
        toast.success(
          t('asset.unlocked', { name: card.name[locale], value: formatShort(card.nextProfit ?? 0, locale) }),
        );
        onClose();
      } else if (result === 'pending') toast.info(t('shop.waiting'));
      else if (result === 'outside') toast.info(t('shop.onlyTelegram'));
      else if (result === 'failed') toast.error(t('shop.failed'));
    });

  const paybackText =
    payback === null
      ? '—'
      : payback < 48
        ? t('asset.payback.hours', {
            n: payback.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
              maximumFractionDigits: payback < 10 ? 1 : 0,
            }),
          })
        : t('asset.payback.days', { n: Math.round(payback / 24) });

  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center" data-testid={`card-sheet-${card.id}`}>
      <motion.div
        initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 15 }}
        className={special ? 'w-full' : ''}
      >
        {special ? (
          <div className="relative overflow-hidden rounded-3xl shadow-glow">
            <CardArt icon={card.icon} seed={card.id} className="block aspect-[16/10] w-full" />
          </div>
        ) : (
          <div className="rounded-full" style={{ filter: `drop-shadow(0 8px 22px ${rarity}55)` }}>
            <CardIcon icon={card.icon} size={112} />
          </div>
        )}
      </motion.div>
      <div className="flex flex-col items-center gap-1.5">
        <h3 className="text-2xl font-black leading-tight">{card.name[locale]}</h3>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide"
          style={{ color: rarity, background: `${rarity}1f`, border: `1px solid ${rarity}55` }}
          data-testid="sheet-rarity"
        >
          {t(`asset.rarity.${card.rarity}`)}
        </span>
      </div>
      <p className="max-w-[330px] text-[15px] font-semibold leading-snug text-white/70">
        {card.description[locale]}
      </p>
      {limited && (
        <p
          className="rounded-full bg-night-600 px-3 py-1 text-xs font-black tabular text-gold"
          data-testid="sheet-limited"
        >
          {t('card.limited')} · {limited}
        </p>
      )}
      <div className="grid w-full grid-cols-2 gap-2" data-testid="sheet-stats">
        <Stat label={t('asset.stat.level')} value={`${card.level} / ${card.maxLevel}`} testId="sheet-level" />
        <Stat
          label={t('asset.stat.pph')}
          value={
            <>
              <CoinIcon size={15} />
              {formatShort(card.profitPerHour, locale)}
            </>
          }
          testId="sheet-pph"
        />
        {card.nextProfit !== null && card.nextPrice !== null && (
          <>
            <Stat
              label={t('asset.stat.next')}
              value={
                <>
                  {t('card.lvl', { n: card.level + 1 })}
                  <span className="text-lime" data-testid="sheet-profit">
                    +{formatShort(card.nextProfit, locale)}
                  </span>
                </>
              }
              testId="sheet-next"
            />
            <Stat
              label={t('asset.stat.cost')}
              value={
                card.starsPrice !== null ? (
                  <span className="flex items-center gap-1 text-gold" data-testid="sheet-stars">
                    <StarIcon size={15} />
                    {card.starsPrice}
                  </span>
                ) : (
                  <span className="flex items-center gap-1" data-testid="sheet-price">
                    <CoinIcon size={15} />
                    {formatShort(card.nextPrice, locale)}
                  </span>
                )
              }
              testId="sheet-cost"
            />
            <Stat
              label={t('asset.stat.expected')}
              value={
                <>
                  <CoinIcon size={15} />
                  {formatShort(card.profitPerHour + card.nextProfit, locale)}
                </>
              }
              testId="sheet-expected"
              accent
            />
            <Stat label={t('asset.stat.payback')} value={paybackText} testId="sheet-payback" />
          </>
        )}
      </div>
      {stars !== null ? (
        <>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={busy}
            onClick={(e) => void unlock(e.currentTarget)}
            className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#ffd75e] to-[#f5a300] text-base font-black text-night-900 shadow-card disabled:opacity-60"
            data-testid="card-unlock"
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-night-900/30 border-t-night-900" />
            ) : (
              <>
                {t('asset.unlock')}
                <StarIcon size={20} />
                <span className="tabular">{stars}</span>
              </>
            )}
          </motion.button>
          <p className="text-xs font-semibold text-white/50">{t('asset.unlockHint')}</p>
        </>
      ) : (
        <Button
          block
          className="mt-1 h-14 text-base"
          disabled={Boolean(block)}
          loading={busy}
          onClick={(e) => void buy(e.currentTarget)}
          data-testid="card-buy"
        >
          {blockText() ?? (card.level === 0 ? t('asset.buy') : t('card.get'))}
        </Button>
      )}
      {stars === null && card.starsPrice !== null && (
        <p className="text-xs font-semibold text-white/50">{t('asset.unlockHint')}</p>
      )}
      {card.lock?.type === 'task' && (
        <Button
          block
          variant="secondary"
          className="h-12"
          onClick={() => {
            onClose();
            useNav.getState().push('earn');
          }}
          data-testid="card-to-tasks"
        >
          {t('card.toTasks')}
        </Button>
      )}
      <p
        className="max-w-[320px] text-[11px] font-semibold leading-snug text-white/35"
        data-testid="asset-disclaimer"
      >
        {t('asset.disclaimer')}
      </p>
    </div>
  );
}
