import { formatShort, type CardView } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon, StarIcon } from '../../components/icons';
import { useLocale, useT } from '../../i18n';
import { useCards } from '../../store/cards';
import { haptic } from '../../telegram/webapp';
import { CardSheet } from '../mine/CardSheet';
import { lockText } from '../mine/cardText';
import { RARITY_COLOR } from '../mine/rarity';
import { useOnTabShow } from '../../hooks/tabLayer';

/** Строка платного актива: монета, название, доход 1-го уровня и цена в Stars (или условие открытия). */
function AssetRow({ card, onOpen }: { card: CardView; onOpen: (card: CardView) => void }) {
  const t = useT();
  const locale = useLocale();
  const rarity = RARITY_COLOR[card.rarity];
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => onOpen(card)}
      className="flex items-center gap-3 rounded-card border bg-night-700 p-3 text-left shadow-card"
      style={{ borderColor: `${rarity}55` }}
      data-testid={`shop-asset-${card.id}`}
    >
      <CardIcon icon={card.icon} size={48} muted={Boolean(card.lock) || !card.available} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold">{card.name[locale]}</p>
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: rarity }}>
          {t(`asset.rarity.${card.rarity}`)}
        </p>
        {card.lock ? (
          <p className="line-clamp-1 text-xs font-semibold text-white/50">
            {lockText(locale, card.lock, true)}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs font-extrabold text-lime">
            <CoinIcon size={13} />+
            {t('card.perHourDelta', { value: formatShort(card.nextProfit ?? 0, locale) })}
          </p>
        )}
      </div>
      <span
        className={`flex h-10 min-w-[72px] shrink-0 items-center justify-center gap-1 rounded-2xl px-3 text-[15px] font-black shadow-card ${
          card.lock || !card.available
            ? 'bg-night-600 text-white/50'
            : 'bg-gradient-to-br from-[#ffd75e] to-[#f5a300] text-night-900'
        }`}
      >
        <StarIcon size={16} />
        <span className="tabular">{card.starsPrice}</span>
      </span>
    </motion.button>
  );
}

/** Раздел магазина «Активы»: ещё не открытые активы за Stars — от дешёвых к дорогим. */
export function AssetOffers() {
  const t = useT();
  const cards = useCards((s) => s.cards);
  const status = useCards((s) => s.status);
  const load = useCards((s) => s.load);
  const [openId, setOpenId] = useState<string | null>(null);
  useOnTabShow(() => void load());
  const offers = useMemo(
    () =>
      cards
        .filter((c) => c.starsPrice !== null)
        .sort((a, b) => a.starsPrice! - b.starsPrice! || a.id.localeCompare(b.id)),
    [cards],
  );
  const openCard = openId ? (cards.find((c) => c.id === openId) ?? null) : null;

  return (
    <div className="flex flex-col gap-2.5" data-testid="shop-assets">
      <p className="text-xs font-semibold text-white/45">{t('shop.assetsHint')}</p>
      {cards.length === 0 && status !== 'error' ? (
        [0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-card" />)
      ) : offers.length === 0 ? (
        <p className="mt-6 text-center text-sm font-bold text-white/55" data-testid="shop-assets-empty">
          {t('shop.assetsEmpty')}
        </p>
      ) : (
        offers.map((card) => (
          <AssetRow
            key={card.id}
            card={card}
            onOpen={(c) => {
              haptic.impact('light');
              setOpenId(c.id);
            }}
          />
        ))
      )}
      <p className="mt-1 text-[11px] font-semibold leading-snug text-white/35">{t('asset.disclaimer')}</p>
      <CardSheet card={openCard} onClose={() => setOpenId(null)} />
    </div>
  );
}
