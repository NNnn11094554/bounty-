import {
  formatDuration,
  formatShort,
  type BoostsState,
  type BoostType,
  type PlayerState,
} from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { endpoints } from '../../api/endpoints';
import { BottomSheet } from '../../components/BottomSheet';
import { EnergyLimitIcon, FullEnergyIcon, MultitapIcon, TurboIcon } from '../../components/boostIcons';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { runAction } from '../../game/actions';
import { centerOf, confetti } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useGame } from '../../store/game';
import { useNav } from '../../store/nav';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';

type Kind = 'fullEnergy' | 'turbo' | 'multitap' | 'energyLimit';
const TYPE: Record<Kind, BoostType> = {
  fullEnergy: 'full-energy',
  turbo: 'turbo',
  multitap: 'multitap',
  energyLimit: 'energy-limit',
};
const ICON: Record<Kind, (p: { size?: number }) => ReactNode> = {
  fullEnergy: FullEnergyIcon,
  turbo: TurboIcon,
  multitap: MultitapIcon,
  energyLimit: EnergyLimitIcon,
};

/** Предсказание результата покупки — для оптимистичного обновления интерфейса. */
function predict(kind: Kind, s: PlayerState): PlayerState {
  const b: BoostsState = structuredClone(s.boosts);
  const now = s.serverTime;
  if (kind === 'fullEnergy') {
    b.fullEnergy.left -= 1;
    b.fullEnergy.cooldownUntil = now + b.fullEnergy.cooldownSec * 1000;
    return { ...s, energy: s.maxEnergy, boosts: b };
  }
  if (kind === 'turbo') {
    b.turbo.left -= 1;
    b.turbo.activeUntil = now + b.turbo.durationSec * 1000;
    return { ...s, turboUntil: b.turbo.activeUntil, boosts: b };
  }
  const paid = b[kind];
  const price = paid.price ?? 0;
  const next = (paid.nextLevel ?? paid.level) + 1;
  paid.level = paid.nextLevel ?? paid.level;
  paid.nextLevel = next <= paid.maxLevel ? next : null;
  paid.price = next <= paid.maxLevel ? price * 2 : null;
  if (kind === 'multitap')
    return { ...s, balance: s.balance - price, multitapLevel: paid.level, tapValue: paid.level, boosts: b };
  return {
    ...s,
    balance: s.balance - price,
    energyLimitLevel: paid.level,
    maxEnergy: s.maxEnergy + b.energyLimit.perLevel,
    boosts: b,
  };
}

interface BoostView {
  title: string;
  desc: string;
  effect?: string;
  price: number | null;
  blocked: string | null;
  cta: string;
}

/** Экран бустов: бесплатные ежедневные и платные усилители. */
export function BoostsScreen() {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const pop = useNav((s) => s.pop);
  const [open, setOpen] = useState<Kind | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useNow(1000);
  if (!player) return null;
  const b = player.boosts;
  const serverNow = now + (player.serverTime - Date.now()) + 0;

  const freeStatus = (kind: 'fullEnergy' | 'turbo'): string => {
    if (kind === 'turbo' && b.turbo.activeUntil && b.turbo.activeUntil > serverNow) return t('boosts.active');
    if (b[kind].left <= 0) return t('boosts.tomorrow');
    const cd = kind === 'fullEnergy' ? b.fullEnergy.cooldownUntil : null;
    if (cd && cd > serverNow) {
      const sec = Math.ceil((cd - serverNow) / 1000);
      return sec >= 60
        ? t('boosts.minutesLeft', { m: Math.ceil(sec / 60) })
        : t('boosts.secondsLeft', { s: sec });
    }
    return t('boosts.available', { left: b[kind].left, total: b[kind].perDay });
  };

  const view = (kind: Kind): BoostView => {
    const balance = tapEngine.balanceNow();
    if (kind === 'fullEnergy') {
      const cd = b.fullEnergy.cooldownUntil;
      const blocked =
        b.fullEnergy.left <= 0
          ? t('boost.usedUp')
          : cd && cd > serverNow
            ? t('boost.availableIn', { time: formatDuration((cd - serverNow) / 1000) })
            : null;
      return {
        title: t('boost.fullEnergy.title'),
        desc: t('boost.fullEnergy.desc', { perDay: b.fullEnergy.perDay }),
        price: 0,
        blocked,
        cta: t('boost.activate'),
      };
    }
    if (kind === 'turbo') {
      const active = b.turbo.activeUntil && b.turbo.activeUntil > serverNow;
      const blocked = active ? t('boost.turboActive') : b.turbo.left <= 0 ? t('boost.usedUp') : null;
      return {
        title: t('boost.turbo.title'),
        desc: t('boost.turbo.desc', {
          sec: b.turbo.durationSec,
          x: b.turbo.multiplier,
          perDay: b.turbo.perDay,
        }),
        price: 0,
        blocked,
        cta: t('boost.activate'),
      };
    }
    const paid = b[kind];
    const blocked =
      paid.price === null ? t('boost.maxLevel') : balance < paid.price ? t('boost.notEnough') : null;
    return {
      title: t(kind === 'multitap' ? 'boost.multitap.title' : 'boost.energyLimit.title'),
      desc: t(kind === 'multitap' ? 'boost.multitap.desc' : 'boost.energyLimit.desc'),
      effect:
        kind === 'multitap'
          ? t('boost.multitap.effect')
          : t('boost.energyLimit.effect', { n: b.energyLimit.perLevel }),
      price: paid.price,
      blocked,
      cta: t('boost.buy'),
    };
  };

  const activate = async (kind: Kind, origin: HTMLElement | null) => {
    if (busy) return;
    setBusy(true);
    const res = await runAction({
      request: () => endpoints.boost(TYPE[kind]),
      predict: (s) => predict(kind, s),
    });
    setBusy(false);
    if (!res) return;
    haptic.notify('success');
    if (kind === 'fullEnergy' || kind === 'turbo') {
      playSound('reward');
      toast.success(t(kind === 'fullEnergy' ? 'boost.energyRestored' : 'boost.turboStarted'));
      setOpen(null);
      pop();
      return;
    }
    playSound('purchase');
    confetti(centerOf(origin));
    const level = res.state.boosts[kind].level;
    toast.success(t('boost.bought', { name: view(kind).title, n: level }));
    setOpen(null);
  };

  const current = open ? view(open) : null;
  const Icon = open ? ICON[open] : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-6 pt-4" data-testid="boosts">
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-bold text-white/55">{t('boosts.balance')}</span>
        <div className="flex items-center gap-2" data-coin-target>
          <CoinIcon size={36} />
          <RollingNumber getValue={() => tapEngine.balanceNow()} className="text-[34px] font-black" />
        </div>
        <button
          type="button"
          onClick={() => setHowOpen(true)}
          className="text-sm font-bold text-gold underline-offset-2 active:underline"
        >
          {t('boosts.howItWorks')}
        </button>
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-extrabold">{t('boosts.free')}</h2>
      <div className="grid grid-cols-2 gap-2.5" data-tour="free-boosts">
        {(['fullEnergy', 'turbo'] as const).map((kind) => {
          const Icon2 = ICON[kind];
          const v = view(kind);
          return (
            <motion.button
              key={kind}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setOpen(kind)}
              className={`flex items-center gap-2.5 rounded-card border border-line bg-night-700 p-3 text-left shadow-card ${v.blocked ? 'opacity-60' : ''}`}
              data-testid={`boost-${TYPE[kind]}`}
            >
              <Icon2 size={44} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold">{v.title}</span>
                <span className="block text-xs font-bold text-white/55">{freeStatus(kind)}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <h2 className="mb-2 mt-6 text-[15px] font-extrabold">{t('boosts.paid')}</h2>
      <div className="flex flex-col gap-2.5" data-tour="paid-boosts">
        {(['multitap', 'energyLimit'] as const).map((kind) => {
          const Icon2 = ICON[kind];
          const paid = b[kind];
          return (
            <motion.button
              key={kind}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setOpen(kind)}
              className="flex items-center gap-3 rounded-card border border-line bg-night-700 p-3 text-left shadow-card"
              data-testid={`boost-${TYPE[kind]}`}
            >
              <Icon2 size={48} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold">{view(kind).title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
                  {paid.price === null ? (
                    <span className="text-gold">{t('boosts.max')}</span>
                  ) : (
                    <>
                      <CoinIcon size={16} />
                      <span className={tapEngine.balanceNow() < paid.price ? 'text-white/45' : ''}>
                        {formatShort(paid.price, locale)}
                      </span>
                      <span className="text-white/45">
                        • {t('boosts.lvl', { n: paid.nextLevel ?? paid.level })}
                      </span>
                    </>
                  )}
                </span>
              </span>
              <span className="text-xl text-white/40">›</span>
            </motion.button>
          );
        })}
      </div>

      <BottomSheet open={open !== null} onClose={() => setOpen(null)} testId="boost-sheet">
        {open && current && Icon && (
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14 }}
            >
              <div className="rounded-[26px] shadow-glow">
                <Icon size={96} />
              </div>
            </motion.div>
            <h3 className="text-2xl font-black">{current.title}</h3>
            <p className="max-w-[320px] text-[15px] font-semibold leading-snug text-white/70">
              {current.desc}
            </p>
            {current.effect && <p className="text-sm font-extrabold text-teal">{current.effect}</p>}
            <div className="flex items-center gap-2 text-2xl font-black">
              {current.price ? (
                <>
                  <CoinIcon size={28} />
                  {formatShort(current.price, locale)}
                  {(open === 'multitap' || open === 'energyLimit') && b[open].nextLevel && (
                    <span className="text-base font-bold text-white/50">
                      • {t('boosts.lvl', { n: b[open].nextLevel ?? 0 })}
                    </span>
                  )}
                </>
              ) : current.price === 0 ? (
                <span className="text-lime">{t('boosts.free.price')}</span>
              ) : null}
            </div>
            <Button
              block
              className="mt-2 h-14 text-base"
              disabled={Boolean(current.blocked)}
              loading={busy}
              onClick={(e) => void activate(open, e.currentTarget)}
              data-testid="boost-confirm"
            >
              {current.blocked ?? current.cta}
            </Button>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={howOpen} onClose={() => setHowOpen(false)} testId="boost-how">
        <div className="flex flex-col gap-3 pt-2">
          <h3 className="text-xl font-black">{t('boosts.howTitle')}</h3>
          <p className="text-[15px] font-semibold leading-snug text-white/75">
            {t('boosts.howText1', { sec: b.turbo.durationSec, x: b.turbo.multiplier })}
          </p>
          <p className="text-[15px] font-semibold leading-snug text-white/75">{t('boosts.howText2')}</p>
          <Button block className="mt-2" onClick={() => setHowOpen(false)}>
            {t('common.ok')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
