import { formatShort, type CosmeticDef, type Rarity } from '@meowgul/shared';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { EFFECT_PARTICLE, RARITY_COLOR } from '../../game/skins';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { CoinIcon, StarIcon } from '../icons';
import { HeroFigure, HeroThumb } from '../hero/HeroFigure';

/** Рамка по редкости: COMMON — простая, RARE — свечение, EPIC — пульс, LEGENDARY — бегущая полоса, MYTHIC — + блик. */
export function RarityFrame({
  rarity,
  children,
  className = '',
}: {
  rarity: Rarity;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rc-frame rc-${rarity.toLowerCase()} ${className}`}>
      {rarity === 'EPIC' && <div className="rc-glow" />}
      {(rarity === 'LEGENDARY' || rarity === 'MYTHIC') && <div className="rc-spin" />}
      <div className="rc-inner">{children}</div>
      {rarity === 'MYTHIC' && <div className="rc-shimmer" />}
    </div>
  );
}

/**
 * Картинка предмета: кот в скине (в сетке — одной картинкой, в окне предмета — живой, с теми же
 * покачиваниями, что на главной) или частица эффекта тапа вокруг монетки.
 */
export function CosmeticPreview({
  item,
  size,
  still = false,
}: {
  item: CosmeticDef;
  size: number;
  still?: boolean;
}) {
  if (item.kind === 'skin') {
    if (still) return <HeroThumb skinId={item.id} height={size} className="cat-still" />;
    return <HeroFigure skinId={item.id} height={size} />;
  }
  const kind = EFFECT_PARTICLE[item.id] ?? 'coin';
  const r = size * 0.36;
  return (
    <div
      className={`relative grid place-items-center ${still ? 'cat-still' : ''}`}
      style={{ width: size, height: size }}
    >
      <CoinIcon size={size * 0.42} />
      <div
        className="cat-orbit absolute inset-0"
        style={{ ['--pt' as string]: `${Math.round(size * 0.17)}px` }}
      >
        {Array.from({ length: 6 }, (_, i) => {
          const a = i * 60;
          return (
            <span
              key={i}
              className={`orbit-pt pt pt-${kind}`}
              style={{
                transform: `rotate(${a}deg) translateY(${-r}px) rotate(${-a}deg)`,
                animationDelay: `${-i * 0.5}s`,
              }}
            >
              {kind === 'code' ? (i % 2 ? '1' : '0') : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  item: CosmeticDef;
  owned: boolean;
  equipped: boolean;
  level: number;
  onOpen: (item: CosmeticDef) => void;
}

/** Карточка коллекции/магазина: превью, имя, редкость и статус (надет / есть / закрыт / цена). */
export function CosmeticCard({ item, owned, equipped, level, onOpen }: Props) {
  const t = useT();
  const locale = useLocale();
  const locked = !owned && level < item.unlockLevel;
  let status: ReactNode;
  if (equipped) status = <span className="text-lime">✓ {t('collection.equipped')}</span>;
  else if (owned) status = <span className="text-white/70">{t('collection.owned')}</span>;
  else if (locked)
    status = (
      <span className="text-white/50">🔒 {t('collection.levelLock', { level: item.unlockLevel })}</span>
    );
  else if (item.price?.currency === 'stars')
    status = (
      <span className="flex items-center gap-1 text-gold">
        <StarIcon size={14} />
        {item.price.amount}
      </span>
    );
  else if (item.price)
    status = (
      <span className="flex items-center gap-1 text-gold">
        <CoinIcon size={14} />
        {formatShort(item.price.amount, locale)}
      </span>
    );
  else status = <span className="text-white/70">{t('collection.free')}</span>;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => onOpen(item)}
      className="block w-full text-left"
      data-testid={`cosmetic-${item.id}`}
      data-state={equipped ? 'equipped' : owned ? 'owned' : locked ? 'locked' : 'available'}
    >
      <RarityFrame rarity={item.rarity}>
        <div className="flex flex-col items-center px-2 pb-2.5 pt-4">
          <div className={locked ? 'opacity-45' : ''}>
            <CosmeticPreview item={item} size={item.kind === 'skin' ? 118 : 84} still />
          </div>
          <p className="mt-3 w-full truncate text-center text-[14px] font-extrabold">{item.name[locale]}</p>
          <p
            className="text-[11px] font-black uppercase tracking-wide"
            style={{ color: RARITY_COLOR[item.rarity] }}
          >
            {t(`rarity.${item.rarity}` as MessageKey)}
          </p>
          <div className="mt-1.5 flex h-6 items-center rounded-full bg-black/30 px-2.5 text-xs font-extrabold">
            {status}
          </div>
        </div>
      </RarityFrame>
    </motion.button>
  );
}
