import { formatShort, formatSigned } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { CatButton, type TapHandler } from '../../components/CatButton';
import { BoltIcon, CoinIcon, PawIcon, RocketIcon } from '../../components/icons';
import { LiveText } from '../../components/LiveText';
import { RollingNumber } from '../../components/RollingNumber';
import { onFrame } from '../../game/frameLoop';
import { leagueAt, leagueProgress, LEAGUE_COUNT } from '../../game/leagues';
import { tapEngine } from '../../game/tapEngine';
import { useLocale, useT } from '../../i18n';
import { useGame } from '../../store/game';

interface Props {
  onOpenBoosts?: () => void;
  onOpenLeagues?: () => void;
  /** плашки дня (шифр и т.п.) между лигой и котом */
  dailyBanner?: ReactNode;
  /** заменить обработчик нажатий (режим ввода шифра) */
  onCatPress?: (durationMs: number) => void;
  /** подпись над котом (вводимая буква шифра) */
  catOverlay?: ReactNode;
  header?: ReactNode;
}

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function StatTile({
  label,
  color,
  children,
  info,
}: {
  label: string;
  color: string;
  children: ReactNode;
  info?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const timer = window.setTimeout(() => window.addEventListener('pointerdown', close, { once: true }), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', close);
    };
  }, [open]);
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border border-line bg-night-700/80 px-1.5 py-2 shadow-card">
      <span
        className="flex items-center gap-1 text-center text-[11px] font-bold leading-tight"
        style={{ color }}
      >
        {label}
        {info && (
          <button
            type="button"
            aria-label="info"
            onClick={() => setOpen((v) => !v)}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-black text-white/80"
          >
            i
          </button>
        )}
      </span>
      <span className="flex items-center gap-1 text-sm font-extrabold tabular">{children}</span>
      {info && open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-line bg-night-600 p-3 text-xs font-semibold leading-snug text-white/85 shadow-card"
          data-testid="per-hour-hint"
        >
          {info}
        </motion.div>
      )}
    </div>
  );
}

/** Главный экран «Офис»: статистика, баланс, лига, кнопка с котом, энергия и бусты. */
export function OfficeScreen({
  onOpenBoosts,
  onOpenLeagues,
  dailyBanner,
  onCatPress,
  catOverlay,
  header,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const config = useGame((s) => s.config);
  const [catBox, catSize] = useBoxSize<HTMLDivElement>();
  const progressRef = useRef<HTMLDivElement>(null);
  const pawRef = useRef<HTMLDivElement>(null);

  const leagues = useMemo(() => config?.leagues ?? [], [config]);
  const leagueLevel = player?.leagueLevel ?? 0;
  const league = leagues.length ? leagueAt(leagues, leagueLevel) : null;

  // прогресс лиги по «живому» всего заработанному — без перерисовки React
  useEffect(() => {
    if (!leagues.length) return;
    let last = -1;
    return onFrame(() => {
      const { ratio } = leagueProgress(leagues, leagueLevel, tapEngine.totalEarnedNow());
      const pct = Math.round(ratio * 1000) / 10;
      if (pct === last) return;
      last = pct;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`;
      if (pawRef.current) pawRef.current.style.left = `${pct}%`;
    });
  }, [leagues, leagueLevel]);

  const handler = useMemo<TapHandler>(
    () => ({
      tap: () => tapEngine.tap(),
      reward: () => tapEngine.tapReward(),
      sleepy: () => {
        const s = tapEngine.state;
        return Boolean(s && !tapEngine.turboActive() && tapEngine.energyNow() < s.tapValue);
      },
      turbo: () => tapEngine.turboActive(),
    }),
    [],
  );

  if (!player || !league || !config) return null;
  const catDiameter = Math.max(140, Math.floor(Math.min(catSize.width * 0.74, catSize.height * 0.94)));
  const isLastLeague = player.leagueLevel >= leagues.length - 1;
  const leagueColor = league.color === 'rainbow' ? '#ffc93c' : league.color;

  return (
    <div className="flex h-full flex-col" data-testid="office">
      <header className="flex items-center gap-2.5 px-4 pb-2 pt-3">
        <Avatar name={player.profile.firstName} photoUrl={player.profile.photoUrl} size={38} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-extrabold" data-testid="player-name">
            {player.profile.firstName}
          </p>
          <p className="text-xs font-bold text-white/50">{t('office.ceo')}</p>
        </div>
        {header}
      </header>

      <div className="flex gap-2 px-4">
        <StatTile label={t('office.perTap')} color="#ff8a3d">
          <CoinIcon size={16} />
          <span data-testid="stat-per-tap">{formatSigned(player.tapValue, locale)}</span>
        </StatTile>
        <StatTile label={t('office.toLevelUp')} color="#a66bff">
          {isLastLeague ? (
            <span>{t('office.maxLeague')}</span>
          ) : (
            <LiveText
              testId="stat-to-level"
              getText={() =>
                formatShort(
                  leagueProgress(leagues, player.leagueLevel, tapEngine.totalEarnedNow()).left ?? 0,
                  locale,
                )
              }
            />
          )}
        </StatTile>
        <StatTile
          label={t('office.perHour')}
          color="#2ed3c6"
          info={t('office.perHourHint', { hours: config.passive.maxOfflineHours })}
        >
          <CoinIcon size={16} />
          <span data-testid="stat-per-hour">{formatSigned(player.profitPerHour, locale)}</span>
        </StatTile>
      </div>

      <section className="office-arc relative mt-4 flex min-h-0 flex-1 flex-col rounded-t-[40px] px-4 pt-5">
        <div className="flex items-center justify-center gap-2.5" data-testid="balance">
          <CoinIcon size={44} />
          <RollingNumber
            getValue={() => tapEngine.balanceNow()}
            className="text-[42px] font-black tracking-tight"
            testId="balance-value"
          />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-sm font-extrabold">
            <button
              type="button"
              onClick={onOpenLeagues}
              disabled={!onOpenLeagues}
              className="flex items-center gap-1"
              data-testid="league-name"
              style={{ color: leagueColor }}
            >
              {league.name}
              {onOpenLeagues && <span className="text-white/60">›</span>}
            </button>
            <span className="text-white/60" data-testid="league-level">
              {t('office.level', { n: player.leagueLevel + 1, total: LEAGUE_COUNT })}
            </span>
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-white/10">
            <div
              ref={progressRef}
              className="h-full origin-left rounded-full bg-progress"
              style={{ transform: 'scaleX(0)' }}
            />
            <div
              ref={pawRef}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold drop-shadow"
              style={{ left: '0%' }}
            >
              <PawIcon size={18} />
            </div>
          </div>
        </div>

        {dailyBanner}

        <div ref={catBox} className="relative flex min-h-0 flex-1 items-center justify-center py-4">
          {catOverlay}
          {catSize.width > 0 && (
            <CatButton
              size={catDiameter}
              ringColor={league.color}
              handler={handler}
              locale={locale}
              sleepyLabel={t('office.tired')}
              onPress={onCatPress}
            />
          )}
        </div>

        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-1.5 text-[15px] font-extrabold" data-testid="energy">
            <BoltIcon size={22} />
            <LiveText
              getText={() => `${tapEngine.energyNow()} / ${tapEngine.state?.maxEnergy ?? 0}`}
              className="tabular"
              testId="energy-value"
            />
          </div>
          {onOpenBoosts && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onOpenBoosts}
              className="flex items-center gap-1.5 rounded-2xl px-2 py-1 text-[15px] font-extrabold"
              data-testid="open-boosts"
            >
              <RocketIcon size={24} />
              {t('office.boost')}
            </motion.button>
          )}
        </div>
      </section>
    </div>
  );
}
