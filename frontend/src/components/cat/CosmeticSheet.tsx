import { formatInt, playerLevel, type CosmeticDef } from '@meowgul/shared';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { centerOf, confetti } from '../../game/effects';
import { RARITY_COLOR, skinArt } from '../../game/skins';
import { tapEngine } from '../../game/tapEngine';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useCollection } from '../../store/collection';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';
import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { CoinIcon, StarIcon } from '../icons';
import { HeroFigure } from '../hero/HeroFigure';
import { SkinScene } from '../hero/SkinScene';
import { CosmeticPreview, RarityFrame } from './CosmeticCard';
import { lockOf, useLeagueName } from './lock';

/**
 * Большой просмотр персонажа: он в полный рост в своём мире — фон стоит так, что персонаж на своём месте
 * (как на главном экране), со спокойной анимацией и атмосферой.
 */
function SkinPreviewStage({
  id,
  stageRef,
  children,
}: {
  id: string;
  stageRef: RefObject<HTMLDivElement>;
  children?: ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef]);
  const art = skinArt(id);
  const height = Math.max(0, Math.min(250, size.height - 30));
  const width = height * art.aspect;
  const fit = size.width
    ? { left: size.width / 2 - width * art.body, top: size.height - 12 - height, width, height }
    : null;
  return (
    <div
      ref={stageRef}
      className="relative h-[300px] overflow-hidden rounded-[18px] short:h-[240px]"
      data-testid="skin-preview"
    >
      <SkinScene key={id} skinId={id} fit={fit} />
      {fit && (
        <div key={`f-${id}`} className="hero-enter absolute" style={{ left: fit.left, top: fit.top }}>
          <HeroFigure skinId={id} height={height} />
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Окно предмета. Для персонажа — полный просмотр: он сам в полный рост в своём мире (фон, свет, частицы,
 * спокойная анимация), редкость, имя, описание, как получить и действие (надеть / купить / закрыт).
 */
export function CosmeticSheet({ item, onClose }: { item: CosmeticDef | null; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const owned = useCollection((s) => s.owned);
  const busy = useCollection((s) => s.busy);
  const buy = useCollection((s) => s.buy);
  const equip = useCollection((s) => s.equip);
  const cosmetics = useGame((s) => s.player?.cosmetics);
  const league = useGame((s) => s.player?.leagueLevel ?? 0);
  const leagueName = useLeagueName();
  const previewRef = useRef<HTMLDivElement>(null);
  // при закрытии окно уезжает с последним предметом, а не пустым
  const lastRef = useRef(item);
  if (item) lastRef.current = item;
  const shown = item ?? lastRef.current;

  const content = (() => {
    if (!shown) return null;
    const isOwned = owned.includes(shown.id);
    const equipped = cosmetics ? cosmetics.skin === shown.id || cosmetics.effect === shown.id : false;
    const level = playerLevel(tapEngine.totalEarnedNow()).level;
    const lock = lockOf(shown, isOwned, level, league);
    const locked = Boolean(lock);
    const lockLabel =
      lock?.by === 'league'
        ? t('collection.leagueLock', { league: leagueName(lock.league) })
        : t('collection.levelLock', { level: shown.unlockLevel });
    const coinsPrice = shown.price?.currency === 'coins' ? shown.price.amount : null;
    const noFunds = coinsPrice !== null && tapEngine.balanceNow() < coinsPrice;

    const done = (key: MessageKey) => {
      toast.success(t(key));
      haptic.notify('success');
      playSound('reward');
      confetti(centerOf(previewRef.current), 60);
    };
    const fail = (result: string) => {
      if (result === 'cancelled' || result === 'pending' || result === 'outside') {
        if (result === 'outside') toast.info(t('shop.onlyTelegram'));
        if (result === 'pending') toast.info(t('shop.waiting'));
        return;
      }
      const key = (
        ['locked', 'funds', 'owned'].includes(result)
          ? `collection.error.${result}`
          : 'collection.error.failed'
      ) as MessageKey;
      toast.error(t(key));
      haptic.notify('error');
    };
    const onBuy = async () => {
      const result = await buy(shown.id);
      if (result === 'ok') done('collection.bought');
      else fail(result);
    };
    const onEquip = async () => {
      const result = await equip(shown.id);
      if (result === 'ok') done('collection.equippedToast');
      else fail(result);
    };

    let action;
    if (equipped)
      action = (
        <Button block className="h-12" variant="secondary" disabled data-testid="cosmetic-equipped">
          {t('collection.equippedBtn')}
        </Button>
      );
    else if (isOwned)
      action = (
        <Button
          block
          className="h-12"
          loading={busy === shown.id}
          onClick={() => void onEquip()}
          data-testid="cosmetic-equip"
        >
          {t('collection.equip')}
        </Button>
      );
    else if (lock)
      action = (
        <Button block className="h-12" variant="secondary" disabled data-testid="cosmetic-locked">
          {lock.by === 'league'
            ? t('collection.lockedLeague', { league: leagueName(lock.league) })
            : t('collection.locked', { level: lock.level })}
        </Button>
      );
    else
      action = (
        <Button
          block
          className="h-12"
          loading={busy === shown.id}
          disabled={noFunds}
          onClick={() => void onBuy()}
          data-testid="cosmetic-buy"
        >
          {shown.price?.currency === 'stars'
            ? t('collection.buyStars', { price: shown.price.amount })
            : t('collection.buyCoins', { price: formatInt(coinsPrice ?? 0) })}
        </Button>
      );

    return (
      <div className="flex flex-col items-center pb-2 text-center" data-testid="cosmetic-sheet">
        <RarityFrame rarity={shown.rarity} className="w-full">
          {shown.kind === 'skin' ? (
            <SkinPreviewStage id={shown.id} stageRef={previewRef}>
              {locked && (
                <div className="absolute inset-0 grid place-items-center bg-black/35">
                  <span className="rounded-full bg-black/70 px-3 py-1.5 text-sm font-black">
                    🔒 {lockLabel}
                  </span>
                </div>
              )}
            </SkinPreviewStage>
          ) : (
            <div ref={previewRef} className="flex justify-center px-4 pb-5 pt-8">
              <CosmeticPreview item={shown} size={150} />
            </div>
          )}
        </RarityFrame>
        <p
          className="mt-4 text-[11px] font-black uppercase tracking-[0.18em]"
          style={{ color: RARITY_COLOR[shown.rarity] }}
        >
          {t(`rarity.${shown.rarity}` as MessageKey)}
          {shown.price?.currency === 'stars' && ` · ${t('collection.premium')}`}
          {shown.unlockLeague !== undefined && ` · ${t('collection.leagueReward')}`}
        </p>
        <h2 className="mt-1 text-[24px] font-black leading-tight" data-testid="cosmetic-name">
          {shown.name[locale]}
        </h2>
        <p className="mt-2 max-w-[320px] text-sm font-semibold leading-snug text-white/65">
          {shown.desc[locale]}
        </p>
        {shown.kind === 'effect' && (
          <p className="mt-1 text-xs font-bold text-white/40">{t('collection.tryTap')}</p>
        )}
        {shown.kind === 'skin' && (
          <div className="mt-3 w-full rounded-2xl bg-white/5 px-3 py-2 text-left" data-testid="skin-how-to">
            <p className="text-[11px] font-black uppercase tracking-wide text-white/45">
              {t('collection.howTo')}
            </p>
            <p className="text-[13px] font-bold text-white/80">
              {shown.unlockLeague !== undefined
                ? t('collection.howLeague', { league: leagueName(shown.unlockLeague) })
                : !shown.price
                  ? t('collection.howFree')
                  : shown.price.currency === 'stars'
                    ? t('collection.howStars', { price: shown.price.amount })
                    : t('collection.howLevel', {
                        level: shown.unlockLevel,
                        price: formatInt(shown.price.amount),
                      })}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
          {shown.unlockLeague !== undefined && (
            <span
              className={`rounded-full px-3 py-1 ${league >= shown.unlockLeague ? 'bg-lime/15 text-lime' : 'bg-white/10 text-white/70'}`}
              data-testid="cosmetic-league-req"
            >
              {t('collection.requirementLeague', { league: leagueName(shown.unlockLeague) })} ·{' '}
              {t('collection.yourLeague', { league: leagueName(league) })}
            </span>
          )}
          {shown.unlockLevel > 1 && (
            <span
              className={`rounded-full px-3 py-1 ${level >= shown.unlockLevel ? 'bg-lime/15 text-lime' : 'bg-white/10 text-white/70'}`}
            >
              {t('collection.requirement', { level: shown.unlockLevel })} ·{' '}
              {t('collection.yourLevel', { level })}
            </span>
          )}
          {shown.price && !isOwned && (
            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-gold">
              {shown.price.currency === 'stars' ? <StarIcon size={14} /> : <CoinIcon size={14} />}
              {formatInt(shown.price.amount)}
            </span>
          )}
        </div>
        {noFunds && !isOwned && !locked && (
          <p className="mt-2 text-xs font-bold text-[#ff8a95]">{t('collection.noFunds')}</p>
        )}
        <div className="mt-4 w-full">{action}</div>
      </div>
    );
  })();

  return (
    <BottomSheet open={Boolean(item)} onClose={onClose} testId="cosmetic-modal">
      {content}
    </BottomSheet>
  );
}
