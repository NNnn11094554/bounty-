import { headquartersById, hqColors, hqIcon, playerLevel } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { CardIcon } from '../../components/cards/CardIcon';
import { CatButton, type TapHandler } from '../../components/CatButton';
import { GoldenCoin } from '../../components/GoldenCoin';
import { HappyHourChip } from '../../components/HappyHourChip';
import { BoltIcon, CoinIcon, GearIcon, PawIcon, RocketIcon } from '../../components/icons';
import { CatVisual } from '../../components/cat/CatVisual';
import { PlayerStats } from '../../components/PlayerStats';
import { LiveText } from '../../components/LiveText';
import { RollingNumber } from '../../components/RollingNumber';
import { onFrame } from '../../game/frameLoop';
import { accessoryOverhang } from '../../game/skins';
import { leagueAt, leagueProgress, LEAGUE_COUNT } from '../../game/leagues';
import { tapEngine } from '../../game/tapEngine';
import { useLocale, useT } from '../../i18n';
import { useGame } from '../../store/game';

interface Props {
  onOpenBoosts?: () => void;
  onOpenLeagues?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenCollection?: () => void;
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

/** Главный экран «Офис»: статистика, баланс, лига, кнопка с котом, энергия и бусты. */
export function OfficeScreen({
  onOpenBoosts,
  onOpenLeagues,
  onOpenProfile,
  onOpenCollection,
  onOpenSettings,
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

  const hq = headquartersById(player?.profile.hqId);
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
  // минимальный размер кота; в режиме шифра на низких экранах — чуть меньше, чтобы поместилась строка Морзе
  const minCat = catOverlay ? 100 : 120;
  // аксессуар скина (корона, нимб…) выступает над кругом: оставляем ему место, чтобы не налезал на блок выше
  const overhang = accessoryOverhang(player.cosmetics.skin);
  const catDiameter = Math.max(
    minCat,
    Math.floor(Math.min(catSize.width * 0.74, (catSize.height * 0.94) / (1 + overhang))),
  );
  const leagueColor = league.color === 'rainbow' ? '#ffc93c' : league.color;

  return (
    <div className="flex h-full flex-col" data-testid="office">
      <header
        className="flex items-center gap-2.5 px-4 pb-2 pt-3 short:pb-1.5 short:pt-2"
        style={
          hq ? { background: `linear-gradient(90deg, ${hqColors(hq)[0]}2e, transparent 75%)` } : undefined
        }
      >
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
            <span className="block truncate text-xs font-bold text-white/50" data-testid="player-hq">
              {hq ? t('office.ceoAt', { hq: hq.name[locale] }) : t('office.ceo')}
            </span>
          </span>
          {hq && <CardIcon icon={hqIcon(hq)} size={34} />}
        </motion.button>
        {header}
        {onOpenCollection && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={onOpenCollection}
            aria-label={t('office.collection')}
            className="relative grid h-10 w-10 shrink-0 place-items-center overflow-visible rounded-2xl border border-[#ff4fd8]/40 bg-night-700/80 shadow-card"
            data-testid="open-collection"
          >
            <span className="cat-still relative h-7 w-7">
              <CatVisual size={28} skinId={player.cosmetics.skin} />
            </span>
          </motion.button>
        )}
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

      <section className="office-arc relative mt-4 flex min-h-0 flex-1 flex-col rounded-t-[40px] px-4 pt-5 short:mt-2.5 short:pt-3">
        <div className="flex items-center justify-center gap-2.5" data-testid="balance" data-coin-target>
          <CoinIcon size={44} className="short:h-9 short:w-9" />
          <RollingNumber
            getValue={() => tapEngine.balanceNow()}
            className="text-[42px] font-black tracking-tight short:text-[34px]"
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
          <div className="mt-3 short:mt-1.5" data-tour="league">
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
          className={`relative flex min-h-0 flex-1 items-center justify-center pb-4 ${catOverlay ? 'pt-12 short:pt-11' : 'pt-4 short:pt-2'}`}
        >
          {catOverlay ?? <HappyHourChip />}
          {catSize.width > 0 && (
            <div style={{ paddingTop: Math.round(catDiameter * overhang) }}>
              <CatButton
                size={catDiameter}
                ringColor={league.color}
                handler={handler}
                locale={locale}
                sleepyLabel={t('office.tired')}
                skinId={player.cosmetics.skin}
                effectId={player.cosmetics.effect}
                onPress={onCatPress}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pb-3">
          <div
            className="flex items-center gap-1.5 text-[15px] font-extrabold"
            data-testid="energy"
            data-tour="energy"
          >
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
              data-tour="boosts"
            >
              <RocketIcon size={24} />
              {t('office.boost')}
            </motion.button>
          )}
        </div>
        <GoldenCoin />
      </section>
    </div>
  );
}
