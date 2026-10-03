import { playerLevel } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { HeroStage, type TapHandler } from '../../components/hero/HeroStage';
import { SkinScene } from '../../components/hero/SkinScene';
import { GoldenCoin } from '../../components/GoldenCoin';
import { HappyHourChip } from '../../components/HappyHourChip';
import { BoltIcon, CoinIcon, GearIcon, PawIcon, RocketIcon } from '../../components/icons';
import { EarnNavIcon, MineNavIcon } from '../../components/navIcons';
import { PlayerStats } from '../../components/PlayerStats';
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
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  /** быстрые кнопки главной: карточки Mine и задания Earn */
  onOpenMine?: () => void;
  onOpenEarn?: () => void;
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

/** Быстрая кнопка главной: иконка и подпись, точка — есть что забрать. */
function QuickAction({
  label,
  onClick,
  testId,
  tour,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  testId: string;
  tour?: string;
  badge?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      className="relative flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl border border-line bg-night-700/80 px-2 shadow-card short:h-10"
      data-testid={testId}
      data-tour={tour}
    >
      {children}
      <span className="truncate text-[13px] font-extrabold text-white/85 short:hidden">{label}</span>
      {badge && (
        <span
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-night-700 bg-coral-to"
          data-testid={`${testId}-badge`}
        />
      )}
    </motion.button>
  );
}

/** Главный экран: игрок и уровень, баланс, лига, надетый персонаж в своём мире, энергия и быстрые кнопки. */
export function OfficeScreen({
  onOpenBoosts,
  onOpenLeagues,
  onOpenProfile,
  onOpenSettings,
  onOpenMine,
  onOpenEarn,
  dailyBanner,
  onCatPress,
  catOverlay,
  header,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const config = useGame((s) => s.config);
  const dailyReady = player?.daily.claimedToday === false;
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

  // полоска энергии — каждый кадр по «живой» энергии, без перерисовки React
  const energyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = '';
    return onFrame(() => {
      const max = tapEngine.state?.maxEnergy ?? 0;
      const value = (max ? Math.min(1, tapEngine.energyNow() / max) : 0).toFixed(3);
      if (value === last || !energyRef.current) return;
      last = value;
      energyRef.current.style.transform = `scaleX(${value})`;
    });
  }, []);

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
  // минимальный размер кота; в режиме шифра на низких экранах — чуть меньше, чтобы поместилась строка Морзе
  // сцена с котом и кнопкой TAP занимает всё место между плашками и энергией и масштабируется под него
  const stageH = Math.max(40, Math.floor(catSize.height));
  const leagueColor = league.color === 'rainbow' ? '#ffc93c' : league.color;

  return (
    <div className="flex h-full flex-col" data-testid="office">
      <header className="flex items-center gap-2.5 px-4 pb-2 pt-3 short:pb-1.5 short:pt-2">
        <motion.button
          type="button"
          whileTap={onOpenProfile ? { scale: 0.97 } : undefined}
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
          aria-label={t('office.profile')}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          data-testid="open-profile"
          data-tour="profile"
        >
          <Avatar name={player.profile.firstName} photoUrl={player.profile.photoUrl} size={38} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-extrabold" data-testid="player-name">
                {player.profile.firstName}
              </span>
              <LiveText
                getText={() => t('level.short', { level: playerLevel(tapEngine.totalEarnedNow()).level })}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#ff4fd8] to-[#7a5cff] px-1.5 py-px text-[10px] font-black text-white"
                testId="player-level"
              />
            </span>
          </span>
        </motion.button>
        {header}
        {onOpenSettings && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.88, rotate: 30 }}
            onClick={onOpenSettings}
            aria-label={t('office.settings')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-line bg-night-700/80 text-white/75 shadow-card"
            data-testid="open-settings"
          >
            <GearIcon size={21} />
          </motion.button>
        )}
      </header>

      <PlayerStats />

      <section className="office-arc relative isolate mt-4 flex min-h-0 flex-1 flex-col rounded-t-[40px] px-4 pt-4 short:mt-2.5 short:pt-2.5">
        {/* мир надетого персонажа: фон, свет и атмосфера; смена скина — сцена мягко проявляется */}
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-t-[40px]">
          <SkinScene key={player.cosmetics.skin} skinId={player.cosmetics.skin} testId="skin-scene" />
        </div>
        <div className="flex items-center justify-center gap-2.5" data-testid="balance" data-coin-target>
          <CoinIcon size={34} className="short:h-7 short:w-7" />
          <RollingNumber
            getValue={() => tapEngine.balanceNow()}
            className="text-[34px] font-black leading-tight tracking-tight short:text-[28px]"
            testId="balance-value"
          />
        </div>

        {/* в режиме шифра лига сворачивается — место для строки Морзе над котом */}
        <motion.div
          className="overflow-hidden"
          initial={false}
          animate={catOverlay ? { height: 0, opacity: 0 } : { height: 'auto', opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mt-2 short:mt-1" data-tour="league">
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
        </motion.div>

        {dailyBanner}

        <div
          ref={catBox}
          data-tour="cat"
          className={`relative flex min-h-0 flex-1 items-center justify-center ${catOverlay ? 'pb-2 pt-12 short:pt-11' : ''}`}
        >
          {catOverlay ?? <HappyHourChip />}
          {catSize.width > 0 && (
            <HeroStage
              width={Math.floor(catSize.width)}
              height={stageH}
              handler={handler}
              locale={locale}
              sleepyLabel={t('office.tired')}
              skinId={player.cosmetics.skin}
              effectId={player.cosmetics.effect}
              onPress={onCatPress}
            />
          )}
        </div>

        {/* энергия с полоской заряда, ниже — быстрые кнопки; на низких экранах всё в одну строку */}
        <div className="flex flex-col short:flex-row short:items-center short:gap-2 short:pb-2">
          <div
            className="flex items-center gap-2 pb-2 text-[15px] font-extrabold short:shrink-0 short:gap-1.5 short:pb-0"
            data-testid="energy"
            data-tour="energy"
          >
            <BoltIcon size={20} className="shrink-0" />
            <LiveText
              getText={() => `${tapEngine.energyNow()} / ${tapEngine.state?.maxEnergy ?? 0}`}
              className="tabular shrink-0 whitespace-nowrap"
              testId="energy-value"
            />
            <div className="relative ml-1 h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10 short:hidden">
              <div
                ref={energyRef}
                className="h-full origin-left rounded-full bg-gradient-to-r from-[#ffd84a] to-[#ff8a3d]"
                style={{ transform: 'scaleX(1)' }}
              />
            </div>
          </div>
          {/* быстрые кнопки: карточки, задания, бусты */}
          <div
            className="grid grid-cols-3 gap-2 pb-3 short:flex-1 short:gap-1.5 short:pb-0"
            data-tour="quick"
          >
            {onOpenMine && (
              <QuickAction label={t('nav.mine')} onClick={onOpenMine} testId="open-mine">
                <MineNavIcon active size={22} />
              </QuickAction>
            )}
            {onOpenEarn && (
              <QuickAction label={t('nav.earn')} onClick={onOpenEarn} testId="open-earn" badge={dailyReady}>
                <EarnNavIcon active size={22} />
              </QuickAction>
            )}
            {onOpenBoosts && (
              <QuickAction
                label={t('office.boost')}
                onClick={onOpenBoosts}
                testId="open-boosts"
                tour="boosts"
              >
                <RocketIcon size={22} />
              </QuickAction>
            )}
          </div>
        </div>
        <GoldenCoin />
      </section>
    </div>
  );
}
