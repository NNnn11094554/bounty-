import { formatInt, formatShort, type LeaderboardEntry, type LeagueInfo } from '@meowgul/shared';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { DURATION, isReducedMotion } from '../../animations';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { LeagueAvatar } from '../../components/LeagueAvatar';
import { LiveText } from '../../components/LiveText';
import { onFrame } from '../../game/frameLoop';
import { leagueProgress } from '../../game/leagues';
import { tapEngine } from '../../game/tapEngine';
import { plural, useLocale, useT } from '../../i18n';
import { useGame } from '../../store/game';
import { useLeaderboard } from '../../store/leaderboard';
import { haptic } from '../../telegram/webapp';

const MEDALS = ['#ffc93c', '#c0c7d1', '#cd7f32'];

function leagueColor(league: LeagueInfo): string {
  return league.color === 'rainbow' ? '#ffc93c' : league.color;
}

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank - 1];
  if (medal) {
    return (
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-black text-night-900 shadow-card"
        style={{ background: medal }}
      >
        {rank}
      </span>
    );
  }
  return <span className="w-7 shrink-0 text-center text-[13px] font-extrabold text-white/50">{rank}</span>;
}

function Row({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const t = useT();
  const locale = useLocale();
  return (
    <motion.li
      initial={isReducedMotion() ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 15) * (DURATION.stagger / 1000), duration: 0.25 }}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${entry.isMe ? 'border border-gold/40 bg-gold/10' : 'bg-night-700/70'}`}
      data-testid={entry.isMe ? 'leader-me' : 'leader-row'}
    >
      <RankBadge rank={entry.rank} />
      <Avatar name={entry.name} photoUrl={entry.photoUrl} size={36} />
      <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
        {entry.isMe ? `${entry.name} (${t('leagues.you')})` : entry.name}
      </span>
      <span className="flex items-center gap-1 text-sm font-extrabold tabular">
        <CoinIcon size={16} />
        {formatShort(entry.totalEarned, locale)}
      </span>
    </motion.li>
  );
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-night-700/70 px-3 py-2">
      <span className="skeleton h-6 w-6 rounded-full" />
      <span className="skeleton h-9 w-9 rounded-full" />
      <span className="skeleton h-3.5 flex-1 rounded" />
      <span className="skeleton h-3.5 w-14 rounded" />
    </li>
  );
}

/** Закреплённая строка внизу: моё место в лиге или сколько осталось до неё. */
function MyPlace({ level, rank }: { level: number; rank: number | null }) {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const leagues = useGame((s) => s.config?.leagues ?? []);
  if (!player) return null;
  const myLevel = player.leagueLevel;
  let content;
  if (level === myLevel) {
    content = (
      <>
        <span className="w-7 shrink-0 text-center text-[13px] font-black text-gold" data-testid="my-rank">
          {rank === null ? '—' : formatInt(rank)}
        </span>
        <Avatar name={player.profile.firstName} photoUrl={player.profile.photoUrl} size={36} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{t('leagues.you')}</span>
        <span className="flex items-center gap-1 text-sm font-extrabold tabular">
          <CoinIcon size={16} />
          <LiveText getText={() => formatShort(tapEngine.totalEarnedNow(), locale)} />
        </span>
      </>
    );
  } else if (level < myLevel) {
    content = (
      <span className="flex-1 text-center text-sm font-extrabold text-lime" data-testid="league-passed">
        ✓ {t('leagues.passed')}
      </span>
    );
  } else {
    const target = leagues[level];
    content = (
      <>
        <span className="flex-1 text-sm font-bold text-white/60">{t('leagues.toReach')}</span>
        <span
          className="flex items-center gap-1 text-sm font-extrabold tabular"
          data-testid="league-to-reach"
        >
          <CoinIcon size={16} />
          <LiveText
            getText={() =>
              formatShort(
                Math.max(0, Math.ceil((target?.threshold ?? 0) - tapEngine.totalEarnedNow())),
                locale,
              )
            }
          />
        </span>
      </>
    );
  }
  return (
    <div className="mx-4 mb-3 mt-2 flex min-h-[56px] items-center gap-3 rounded-2xl border border-line bg-night-600 px-3 py-2 shadow-card">
      {content}
    </div>
  );
}

/** Экран лиг: карусель из 10 лиг и топ-100 выбранной лиги. */
export function LeaguesScreen() {
  const t = useT();
  const locale = useLocale();
  const leagues = useGame((s) => s.config?.leagues ?? []);
  const myLevel = useGame((s) => s.player?.leagueLevel ?? 0);
  const [level, setLevel] = useState(myLevel);
  const [direction, setDirection] = useState(0);
  const entry = useLeaderboard((s) => s.leagues[level]);
  const load = useLeaderboard((s) => s.load);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  const league = leagues[level];
  if (!league) return null;
  const go = (delta: number) => {
    const next = level + delta;
    if (next < 0 || next >= leagues.length) return;
    haptic.select();
    setDirection(delta);
    setLevel(next);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 500) go(-1);
  };
  const progress = level === myLevel && leagues[level + 1];
  const reduced = isReducedMotion();
  const data = entry?.data?.level === level ? entry.data : null;
  const players = data?.players ?? [];

  return (
    <div className="flex h-full flex-col" data-testid="leagues">
      <div className="relative flex items-center justify-between px-3 pt-4">
        <ArrowButton dir={-1} disabled={level === 0} onClick={() => go(-1)} label={t('leagues.prev')} />
        <motion.div
          className="flex flex-1 touch-pan-y flex-col items-center"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={onDragEnd}
          aria-label={league.name}
          data-testid="league-current"
          data-from={formatShort(league.threshold, locale)}
        >
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.div
              key={level}
              custom={direction}
              className="flex flex-col items-center"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 80, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -80, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              <LeagueAvatar league={league} size={150} locked={level > myLevel} />
              <h1 className="mt-4 text-[30px] font-black leading-none" style={{ color: leagueColor(league) }}>
                {league.name}
              </h1>
              <p className="mt-1.5 text-sm font-bold text-white/60">
                {t('leagues.from', { value: formatShort(league.threshold, locale) })}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <ArrowButton
          dir={1}
          disabled={level === leagues.length - 1}
          onClick={() => go(1)}
          label={t('leagues.next')}
        />
      </div>

      {progress && (
        <div className="mx-6 mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <LeagueProgressBar level={level} />
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between px-4">
        <h2 className="text-[15px] font-extrabold">{t('leagues.top')}</h2>
        {data && (
          <span className="text-xs font-bold text-white/45" data-testid="league-total">
            {t('leagues.players', {
              n: formatInt(data.total),
              players: plural(locale, data.total, {
                one: t('leagues.player.one'),
                few: t('leagues.player.few'),
                many: t('leagues.player.many'),
              }),
            })}
          </span>
        )}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-4" data-testid="leaderboard">
        {entry?.status === 'error' && !data ? (
          <div className="flex flex-col items-center gap-3 pt-8 text-center">
            <p className="text-[15px] font-bold text-white/70">{t('leagues.error')}</p>
            <Button variant="secondary" onClick={() => void load(level, true)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : !data ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <RowSkeleton key={i} />
            ))}
          </ul>
        ) : players.length === 0 ? (
          <p className="pt-8 text-center text-[15px] font-bold text-white/55" data-testid="leaderboard-empty">
            {t('leagues.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 pb-2" key={level}>
            {players.map((p, i) => (
              <Row key={`${p.rank}-${p.name}`} entry={p} index={i} />
            ))}
            <li className="py-2 text-center text-[11px] font-bold text-white/35">{t('leagues.updated')}</li>
          </ul>
        )}
      </div>

      <MyPlace level={level} rank={data?.me.rank ?? null} />
    </div>
  );
}

/** Прогресс до следующей лиги по «живому» всего заработанному — без перерисовки React. */
function LeagueProgressBar({ level }: { level: number }) {
  const leagues = useGame((s) => s.config?.leagues ?? []);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = -1;
    return onFrame(() => {
      const { ratio } = leagueProgress(leagues, level, tapEngine.totalEarnedNow());
      if (ratio === last || !ref.current) return;
      last = ratio;
      ref.current.style.transform = `scaleX(${ratio})`;
    });
  }, [leagues, level]);
  return (
    <div
      ref={ref}
      className="h-full origin-left rounded-full bg-progress"
      style={{ transform: 'scaleX(0)' }}
      data-testid="league-progress"
    />
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: 1 | -1;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-night-700 shadow-card ${disabled ? 'opacity-30' : ''}`}
      data-testid={dir < 0 ? 'league-prev' : 'league-next'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}
