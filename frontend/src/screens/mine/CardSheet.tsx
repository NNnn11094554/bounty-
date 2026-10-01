import { formatDuration, formatShort, type CardView } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CardArt, CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { cardBlock, upgradeCard } from '../../game/cards';
import { centerOf, confetti } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useAffordable } from '../../hooks/useAffordable';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT } from '../../i18n';
import { playSound } from '../../lib/sound';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { limitedText, lockText } from './cardText';

interface Props {
  card: CardView | null;
  onClose: () => void;
}

/** Шторка карточки: описание, прирост прибыли, цена и кнопка «Получить». */
export function CardSheet({ card, onClose }: Props) {
  return (
    <BottomSheet open={card !== null} onClose={onClose} testId="card-sheet">
      {card && <CardSheetBody card={card} onClose={onClose} />}
    </BottomSheet>
  );
}

function CardSheetBody({ card, onClose }: { card: CardView; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  // перерисовка, когда монет становится достаточно (пассивный доход капает)
  useAffordable(card.nextPrice);
  const serverNow = now + (tapEngine.serverNow() - Date.now());
  const block = cardBlock(card, tapEngine.balanceNow(), serverNow);
  const special = card.category === 'SPECIALS';
  const limited = limitedText(locale, card, serverNow);

  const blockText = (): string | null => {
    if (!block) return null;
    switch (block.kind) {
      case 'max':
        return t('card.maxLevel');
      case 'unavailable':
        return card.limited ? t('card.limited.over') : t('card.unavailable');
      case 'locked':
        return card.lock ? lockText(locale, card.lock) : t('action.error.locked');
      case 'cooldown':
        return t('card.cooldown', { time: formatDuration((block.until - serverNow) / 1000) });
      case 'funds':
        return t('card.notEnough');
    }
  };

  const buy = async (origin: HTMLElement) => {
    if (busy || block) return;
    setBusy(true);
    const res = await upgradeCard(card);
    setBusy(false);
    if (!res) return;
    haptic.notify('success');
    playSound('purchase');
    confetti(centerOf(origin));
    const level = res.cards.find((c) => c.id === card.id)?.level ?? card.level + 1;
    toast.success(t('card.bought', { name: card.name[locale], n: level }));
    onClose();
  };

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
          <div className="rounded-[30px] shadow-glow">
            <CardIcon icon={card.icon} size={112} />
          </div>
        )}
      </motion.div>
      <h3 className="text-2xl font-black leading-tight">{card.name[locale]}</h3>
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
      {card.level > 0 && (
        <p className="text-xs font-bold text-white/50">
          {t('card.current', { value: formatShort(card.profitPerHour, locale) })}
        </p>
      )}
      {card.nextProfit !== null && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-white/55">{t('card.perHour')}</span>
          <span className="flex items-center gap-1.5 text-lg font-black text-lime" data-testid="sheet-profit">
            <CoinIcon size={20} />+{formatShort(card.nextProfit, locale)}
          </span>
        </div>
      )}
      {card.nextPrice !== null && (
        <div className="flex items-center gap-2 text-[28px] font-black" data-testid="sheet-price">
          <CoinIcon size={30} />
          {formatShort(card.nextPrice, locale)}
          <span className="text-base font-bold text-white/50">• {t('card.lvl', { n: card.level + 1 })}</span>
        </div>
      )}
      <Button
        block
        className="mt-1 h-14 text-base"
        disabled={Boolean(block)}
        loading={busy}
        onClick={(e) => void buy(e.currentTarget)}
        data-testid="card-buy"
      >
        {blockText() ?? t('card.get')}
      </Button>
    </div>
  );
}
