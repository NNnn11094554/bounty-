import { CARD_CATEGORIES, type CardCategory, type CardView } from '@meowgul/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isReducedMotion } from '../../animations';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { PlayerStats } from '../../components/PlayerStats';
import { RollingNumber } from '../../components/RollingNumber';
import { tapEngine } from '../../game/tapEngine';
import { useProgressiveCount } from '../../hooks/useProgressiveCount';
import { useT, type MessageKey } from '../../i18n';
import { useCards, type SpecialsTab } from '../../store/cards';
import { useGame } from '../../store/game';
import { haptic } from '../../telegram/webapp';
import { CardSheet } from './CardSheet';
import { ComboPanel } from './ComboPanel';
import { CardTile, CardTileSkeleton } from './CardTile';

const SPECIALS_TABS: readonly SpecialsTab[] = ['mine', 'new', 'upgraded'];

function specialsFilter(tab: SpecialsTab, card: CardView): boolean {
  if (tab === 'new') return card.level === 0;
  if (tab === 'mine') return card.level > 0;
  // улучшенные до конца: максимальный уровень или окно лимитки закрылось
  return card.level > 0 && (card.nextPrice === null || !card.available);
}

function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  layoutId,
  small,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  layoutId: string;
  small?: boolean;
}) {
  return (
    <div
      className={`grid auto-cols-fr grid-flow-col rounded-2xl border border-line bg-night-700/80 p-1 ${small ? 'gap-0.5' : 'gap-1'}`}
      role="tablist"
    >
      {items.map((item) => {
        const active = item === value;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (active) return;
              haptic.select();
              onChange(item);
            }}
            className={`relative rounded-xl font-extrabold ${small ? 'h-8 text-[11px]' : 'h-9 text-[13px]'} ${active ? 'text-white' : 'text-white/50'}`}
            data-testid={`${layoutId}-${item}`}
          >
            {active && <span className="absolute inset-0 rounded-xl bg-night-500 shadow-card" />}
            <span className="relative">{label(item)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Экран «Активы»: крипто-активы по категориям, открытие (монеты или Stars) и прокачка уровней. */
export function MineScreen() {
  const t = useT();
  const cards = useCards((s) => s.cards);
  const status = useCards((s) => s.status);
  const load = useCards((s) => s.load);
  const category = useCards((s) => s.category);
  const setCategory = useCards((s) => s.setCategory);
  const specialsTabSaved = useCards((s) => s.specialsTab);
  const setSpecialsTab = useCards((s) => s.setSpecialsTab);
  const leagueLevel = useGame((s) => s.player?.leagueLevel ?? 0);
  const [openId, setOpenId] = useState<string | null>(null);

  // при открытии и при новой лиге (она может открыть карточки) — свежий список
  useEffect(() => {
    void load();
  }, [load, leagueLevel]);

  const specials = useMemo(() => cards.filter((c) => c.category === 'SPECIALS'), [cards]);
  const specialsTab: SpecialsTab = specialsTabSaved ?? (specials.some((c) => c.level > 0) ? 'mine' : 'new');

  const visible = useMemo(() => {
    const list = cards.filter((c) => c.category === category);
    return category === 'SPECIALS' ? list.filter((c) => specialsFilter(specialsTab, c)) : list;
  }, [cards, category, specialsTab]);

  const open = useCallback((card: CardView) => {
    haptic.impact('light');
    setOpenId(card.id);
  }, []);
  const openCard = openId ? (cards.find((c) => c.id === openId) ?? null) : null;
  const listKey = category === 'SPECIALS' ? `${category}-${specialsTab}` : category;
  const shown = useProgressiveCount(visible.length, listKey);
  const reduced = isReducedMotion();

  return (
    <div className="flex h-full flex-col" data-testid="mine">
      <div className="pt-3" data-tour="income">
        <PlayerStats testIdPrefix="mine-" />
      </div>
      <div
        className="mt-3 flex items-center justify-center gap-2.5"
        data-testid="mine-balance"
        data-coin-target
      >
        <CoinIcon size={38} />
        <RollingNumber
          getValue={() => tapEngine.balanceNow()}
          className="text-[36px] font-black tracking-tight"
        />
      </div>

      <ComboPanel />

      <div className="mt-3 px-4">
        <Segmented<CardCategory>
          items={CARD_CATEGORIES}
          value={category}
          onChange={setCategory}
          label={(c) => t(`mine.category.${c}` as MessageKey)}
          layoutId="mine-cat"
        />
        {category === 'SPECIALS' && (
          <div className="mt-2">
            <Segmented<SpecialsTab>
              items={SPECIALS_TABS}
              value={specialsTab}
              onChange={setSpecialsTab}
              label={(tab) => t(`mine.specials.${tab}` as MessageKey)}
              layoutId="mine-specials"
              small
            />
          </div>
        )}
      </div>

      <div
        className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        data-testid="mine-list"
        data-tour="cards"
      >
        {status === 'error' && cards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-10 text-center">
            <p className="text-[15px] font-bold text-white/70">{t('mine.error')}</p>
            <Button variant="secondary" onClick={() => void load(true)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : cards.length === 0 ? (
          <div className="grid grid-cols-2 gap-2.5" data-testid="mine-skeleton">
            {Array.from({ length: 6 }, (_, i) => (
              <CardTileSkeleton key={i} special={category === 'SPECIALS'} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-10 text-center" data-testid="mine-empty">
            <p className="max-w-[280px] text-[15px] font-bold text-white/60">
              {t(`mine.empty.${specialsTab}` as MessageKey)}
            </p>
            {specialsTab !== 'new' && specials.some((c) => c.level === 0) && (
              <Button variant="secondary" onClick={() => setSpecialsTab('new')}>
                {t('mine.empty.showNew')}
              </Button>
            )}
          </div>
        ) : (
          // другая категория — список проявляется целиком (150 мс, CSS); без анимации на каждую из десятков
          // плиток: экран открывают часто, а каскад только задерживал первый кадр
          <div key={listKey} className={`grid grid-cols-2 gap-2.5 ${reduced ? '' : 'screen-in'}`}>
            {visible.slice(0, shown).map((card) => (
              <div key={card.id} className="cv-tile flex">
                <CardTile card={card} onOpen={open} />
              </div>
            ))}
          </div>
        )}
        {cards.length > 0 && (
          <p
            className="mx-auto mt-4 max-w-[320px] text-center text-[11px] font-semibold leading-snug text-white/35"
            data-testid="mine-disclaimer"
          >
            {t('asset.disclaimer')}
          </p>
        )}
      </div>

      <CardSheet card={openCard} onClose={() => setOpenId(null)} />
    </div>
  );
}
