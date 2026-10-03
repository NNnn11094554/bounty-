import { formatShort, type CosmeticDef, type Rarity } from '@meowgul/shared';
import type { KeyboardEvent, ReactNode } from 'react';
import { EFFECT_PARTICLE, RARITY_COLOR } from '../../game/skins';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { lockOf, useLeagueName, type CosmeticLock } from './lock';
import { Button } from '../Button';
import { CoinIcon, StarIcon } from '../icons';
import { SkinPicture } from '../hero/HeroFigure';

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

/** Эффект тапа: частицы эффекта кружат вокруг монетки. */
export function CosmeticPreview({
  item,
  size,
  still = false,
}: {
  item: CosmeticDef;
  size: number;
  still?: boolean;
}) {
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

/** Коротко, что держит замок: «Лига Gold» или «Ур. 6». */
function useLockText(): (lock: NonNullable<CosmeticLock>) => string {
  const t = useT();
  const leagueName = useLeagueName();
  return (lock) =>
    lock.by === 'league'
      ? t('collection.leagueLock', { league: leagueName(lock.league) })
      : t('collection.levelLock', { level: lock.level });
}

interface Props {
  item: CosmeticDef;
  owned: boolean;
  equipped: boolean;
  level: number;
  /** лига игрока: скины-награды открываются по ней */
  league: number;
  onOpen: (item: CosmeticDef) => void;
  /** надеть прямо с карточки (свой, ещё не надетый скин) */
  onEquip?: (item: CosmeticDef) => void;
  /** id предмета, с которым идёт действие */
  busy?: string | null;
}

/** Условие получения коротко: лига, уровень, цена или «бесплатно». */
function Condition({ item, owned, lock }: { item: CosmeticDef; owned: boolean; lock: CosmeticLock }) {
  const t = useT();
  const locale = useLocale();
  const lockText = useLockText();
  if (owned) return null;
  if (lock) return <span className="text-white/70">🔒 {lockText(lock)}</span>;
  if (item.price?.currency === 'stars')
    return (
      <span className="flex items-center gap-1 text-gold">
        <StarIcon size={13} />
        {item.price.amount}
      </span>
    );
  if (item.price)
    return (
      <span className="flex items-center gap-1 text-gold">
        <CoinIcon size={13} />
        {formatShort(item.price.amount, locale)}
      </span>
    );
  return <span className="text-white/70">{t('collection.free')}</span>;
}

/**
 * Карточка персонажа: картинка в его мире, редкость, имя, статус (надет / есть / закрыт), условие
 * получения и кнопка «Надеть» для своих. Картинка загружается лениво — только когда карточка на экране.
 */
function SkinCard({ item, owned, equipped, level, league, onOpen, onEquip, busy }: Props) {
  const t = useT();
  const locale = useLocale();
  const lock = lockOf(item, owned, level, league);
  const locked = Boolean(lock);
  const state = equipped ? 'equipped' : owned ? 'owned' : locked ? 'locked' : 'available';
  const open = () => onOpen(item);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKey}
      className="press block w-full cursor-pointer text-left"
      data-testid={`cosmetic-${item.id}`}
      data-state={state}
    >
      <RarityFrame rarity={item.rarity}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-night-800">
          <SkinPicture
            skinId={item.id}
            file="preview"
            className={`h-full w-full object-cover ${locked ? 'brightness-[0.45] saturate-[0.6]' : ''}`}
            alt={item.name[locale]}
          />
          <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
          <span
            className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
            style={{ color: RARITY_COLOR[item.rarity] }}
          >
            {t(`rarity.${item.rarity}` as MessageKey)}
          </span>
          {(equipped || owned || locked) && (
            <span
              className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                equipped
                  ? 'bg-lime text-night-900'
                  : owned
                    ? 'bg-white/85 text-night-900'
                    : 'bg-black/60 text-white/80'
              }`}
              data-testid={`cosmetic-status-${item.id}`}
            >
              {equipped ? `✓ ${t('collection.equipped')}` : owned ? t('collection.owned') : '🔒'}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 px-2.5 pb-2.5">
            <p className="truncate text-[15px] font-black leading-tight">{item.name[locale]}</p>
            <div className="flex min-h-[24px] items-center justify-between gap-1 text-xs font-extrabold">
              <Condition item={item} owned={owned} lock={lock} />
              {owned && !equipped && onEquip && (
                <Button
                  className="h-7 px-3 text-xs"
                  loading={busy === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEquip(item);
                  }}
                  data-testid={`equip-${item.id}`}
                >
                  {t('collection.equip')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </RarityFrame>
    </div>
  );
}

/** Карточка коллекции/магазина: превью, имя, редкость и статус (надет / есть / закрыт / цена). */
export function CosmeticCard(props: Props) {
  if (props.item.kind === 'skin') return <SkinCard {...props} />;
  return <EffectCard {...props} />;
}

function EffectCard({ item, owned, equipped, level, league, onOpen }: Props) {
  const t = useT();
  const locale = useLocale();
  const lock = lockOf(item, owned, level, league);
  const locked = Boolean(lock);
  const lockText = useLockText();
  let status: ReactNode;
  if (equipped) status = <span className="text-lime">✓ {t('collection.equipped')}</span>;
  else if (owned) status = <span className="text-white/70">{t('collection.owned')}</span>;
  else if (lock) status = <span className="text-white/50">🔒 {lockText(lock)}</span>;
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
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="press block w-full text-left"
      data-testid={`cosmetic-${item.id}`}
      data-state={equipped ? 'equipped' : owned ? 'owned' : locked ? 'locked' : 'available'}
    >
      <RarityFrame rarity={item.rarity}>
        <div className="flex flex-col items-center px-2 pb-2.5 pt-4">
          <div className={locked ? 'opacity-45' : ''}>
            <CosmeticPreview item={item} size={84} still />
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
    </button>
  );
}
