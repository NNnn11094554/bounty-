import { formatDuration, formatInt, type ShopProduct } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { FullEnergyIcon } from '../../components/boostIcons';
import { Segmented } from '../../components/Segmented';
import { CosmeticGrid } from '../collection/CollectionScreen';
import { AssetOffers } from './AssetOffers';
import { CoinIcon, StarIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { catMood } from '../../game/catMood';
import { centerOf, confetti } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useT, type MessageKey } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useGame } from '../../store/game';
import { useShop } from '../../store/shop';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { useOnTabShow } from '../../hooks/tabLayer';

/** Стопка монет: чем больше пакет, тем выше стопка. */
function CoinStack({ count }: { count: number }) {
  return (
    <span className="relative block h-12 w-12 shrink-0">
      {Array.from({ length: count }, (_, i) => (
        <CoinIcon
          key={i}
          size={34}
          className="absolute"
          style={{ left: 7 + (i % 2 ? 4 : -4) * Math.min(1, i), bottom: i * 5 }}
        />
      ))}
    </span>
  );
}

function IncomeIcon() {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#2ed3c6] to-[#1b6f8f] text-lg font-black text-white shadow-card">
      ×2
    </span>
  );
}

const STACK: Record<string, number> = { coins_small: 1, coins_medium: 2, coins_large: 3 };

function ProductCard({
  product,
  icon,
  title,
  desc,
  extra,
}: {
  product: ShopProduct;
  icon: ReactNode;
  title: string;
  desc: ReactNode;
  extra?: ReactNode;
}) {
  const t = useT();
  const buying = useShop((s) => s.buying);
  const buy = useShop((s) => s.buy);
  const busy = buying === product.id;

  const onBuy = async (el: HTMLElement) => {
    haptic.impact('light');
    const result = await buy(product.id);
    if (result === 'paid') {
      toast.success(t('shop.success'));
      catMood.emit('purchase');
      haptic.notify('success');
      playSound('reward');
      confetti(centerOf(el), 60);
    } else if (result === 'pending') toast.info(t('shop.waiting'));
    else if (result === 'outside') toast.info(t('shop.onlyTelegram'));
    else if (result === 'failed') toast.error(t('shop.failed'));
  };

  return (
    <div
      className={`relative flex items-center gap-3 rounded-card border bg-night-700 p-3 shadow-card ${product.popular ? 'border-gold/60' : 'border-line'}`}
      data-testid={`shop-${product.id}`}
    >
      {product.popular && (
        <span className="absolute -top-2 left-3 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black uppercase text-night-900">
          {t('shop.popular')}
        </span>
      )}
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold">{title}</p>
        <div className="text-xs font-semibold leading-snug text-white/55">{desc}</div>
        {extra}
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        disabled={Boolean(buying)}
        onClick={(e) => void onBuy(e.currentTarget)}
        className="flex h-10 min-w-[76px] shrink-0 items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-[#ffd75e] to-[#f5a300] px-3 text-[15px] font-black text-night-900 shadow-card disabled:opacity-60"
        data-testid={`buy-${product.id}`}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-night-900/30 border-t-night-900" />
        ) : (
          <>
            <StarIcon size={17} />
            <span className="tabular">{product.stars}</span>
          </>
        )}
      </motion.button>
    </div>
  );
}

type ShopTab = 'skins' | 'assets' | 'boosts' | 'special' | 'cosmetics';

/** Магазин: скины (главное), крипто-активы за Stars, бусты, особое (монеты) и косметика (эффекты тапа). */
export function ShopScreen({ onOpenCollection }: { onOpenCollection?: () => void }) {
  const t = useT();
  const { products, status, load } = useShop();
  const player = useGame((s) => s.player);
  const now = useNow(1000);
  const [tab, setTab] = useState<ShopTab>('skins');
  // при каждом открытии вкладки — свежие товары (пока грузятся, видны прежние)
  useOnTabShow(() => void load());
  if (!player) return null;

  const serverNow = now + (player.serverTime - Date.now());
  const boostLeft = player.incomeBoostUntil ? Math.max(0, player.incomeBoostUntil - serverNow) : 0;
  const coins = products.filter((p) => p.kind === 'coins');
  const boosters = products.filter((p) => p.kind === 'energy' || p.kind === 'income_boost');
  const productsReady = products.length > 0;

  const productsState =
    status === 'error' && !productsReady ? (
      <p className="mt-10 text-center text-sm font-bold text-white/55">{t('shop.loadError')}</p>
    ) : !productsReady ? (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-[72px] rounded-card" />
        ))}
      </div>
    ) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-8 pt-4" data-testid="shop">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <StarIcon size={26} />
          {t('shop.title')}
        </h1>
        <div className="mt-1 flex items-center gap-2" data-coin-target>
          <CoinIcon size={26} />
          <RollingNumber getValue={() => tapEngine.balanceNow()} className="text-[24px] font-black" />
        </div>
      </div>

      <div className="mb-4 mt-4">
        <Segmented
          options={[
            { value: 'skins', label: t('shop.tab.skins') },
            { value: 'assets', label: t('shop.tab.assets') },
            { value: 'boosts', label: t('shop.tab.boosts') },
            { value: 'special', label: t('shop.tab.special') },
            { value: 'cosmetics', label: t('shop.tab.cosmetics') },
          ]}
          value={tab}
          onChange={setTab}
          testId="shop-tabs"
        />
      </div>

      {tab === 'skins' && (
        <>
          <p className="mb-3 text-xs font-semibold text-white/45">{t('shop.skinsHint')}</p>
          <CosmeticGrid kind="skin" testId="shop-skins" />
          {onOpenCollection && (
            <button
              type="button"
              onClick={onOpenCollection}
              className="mt-4 self-center text-sm font-extrabold text-[#ff8fd0]"
              data-testid="shop-open-collection"
            >
              {t('collection.open')} →
            </button>
          )}
        </>
      )}

      {tab === 'assets' && <AssetOffers />}

      {tab === 'cosmetics' && (
        <>
          <p className="mb-3 text-xs font-semibold text-white/45">{t('shop.cosmeticsHint')}</p>
          <CosmeticGrid kind="effect" testId="shop-effects" />
        </>
      )}

      {tab === 'special' &&
        (productsState ?? (
          <>
            <div className="flex flex-col gap-3">
              {coins.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  icon={<CoinStack count={STACK[p.id] ?? 1} />}
                  title={`+${formatInt(p.coins ?? 0)}`}
                  desc={t(`shop.${p.id}` as MessageKey)}
                  extra={
                    p.bonusPercent ? (
                      <span className="mt-1 inline-block rounded-full bg-lime/15 px-2 py-0.5 text-[11px] font-extrabold text-lime">
                        {t('shop.bonus', { percent: p.bonusPercent })}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-white/40">{t('shop.coinsDesc')}</p>
          </>
        ))}

      {tab === 'boosts' &&
        (productsState ?? (
          <div className="flex flex-col gap-3">
            {boosters.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                icon={p.kind === 'energy' ? <FullEnergyIcon size={48} /> : <IncomeIcon />}
                title={t(`shop.${p.id}` as MessageKey)}
                desc={t(`shop.${p.id}Desc` as MessageKey, { hours: p.hours ?? 0 })}
                extra={
                  p.kind === 'income_boost' && boostLeft > 0 ? (
                    <span
                      className="mt-1 inline-block rounded-full bg-[#2ed3c6]/15 px-2 py-0.5 text-[11px] font-extrabold text-[#2ed3c6]"
                      data-testid="income-boost-left"
                    >
                      {t('shop.active', { time: formatDuration(boostLeft / 1000) })}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ))}

      <p className="mt-6 text-center text-xs font-semibold leading-snug text-white/40">
        {t('shop.subtitle')}
      </p>
      <p className="mt-1 text-center text-xs font-semibold leading-snug text-white/40">{t('shop.note')}</p>
      <p className="mt-1 text-center text-xs font-semibold text-white/40">{t('shop.support')}</p>
    </div>
  );
}
