import { formatShort, formatSigned, INCOME_BOOST_MULTIPLIER } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { leagueProgress } from '../game/leagues';
import { useNow } from '../hooks/useNow';
import { tapEngine } from '../game/tapEngine';
import { useLocale, useT } from '../i18n';
import { useGame } from '../store/game';
import { CoinIcon } from './icons';
import { LiveText } from './LiveText';
import { PerHourValue } from './PerHourValue';

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
    <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border border-line bg-night-700/80 px-1.5 py-2 shadow-card short:gap-0.5 short:py-1.5">
      {/* подпись в одну строку на любой ширине: значок «i» — в углу плитки, а не рядом с текстом */}
      <span
        className="max-w-full truncate whitespace-nowrap text-center text-[11px] font-bold leading-tight short:text-[10px] narrow:text-[10px]"
        style={{ color }}
      >
        {label}
      </span>
      {info && (
        <button
          type="button"
          aria-label="info"
          onClick={() => setOpen((v) => !v)}
          className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-line bg-night-600 text-[10px] font-black text-white/80"
        >
          i
        </button>
      )}
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

/** «×2» у прибыли в час, пока действует буст дохода из магазина. */
function IncomeBoostBadge({ until, serverTime }: { until: number | null; serverTime: number }) {
  const now = useNow(1000);
  const t = useT();
  if (!until || until <= now + (serverTime - Date.now())) return null;
  return (
    <span
      className="rounded-full bg-[#2ed3c6]/20 px-1.5 text-[10px] font-black text-[#2ed3c6]"
      title={t('office.incomeBoost')}
      data-testid="income-boost-badge"
    >
      ×{INCOME_BOOST_MULTIPLIER}
    </span>
  );
}

/** Три плитки статистики: прибыль за тап, монет до следующей лиги, прибыль в час. */
export function PlayerStats({ testIdPrefix = '' }: { testIdPrefix?: string }) {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const config = useGame((s) => s.config);
  if (!player || !config) return null;
  const leagues = config.leagues;
  const isLastLeague = player.leagueLevel >= leagues.length - 1;
  return (
    <div className="flex gap-2 px-4">
      <StatTile label={t('office.perTap')} color="#ff8a3d">
        <CoinIcon size={16} />
        <span data-testid={`${testIdPrefix}stat-per-tap`}>{formatSigned(player.tapValue, locale)}</span>
      </StatTile>
      <StatTile label={t('office.toLevelUp')} color="#a66bff">
        {isLastLeague ? (
          <span>{t('office.maxLeague')}</span>
        ) : (
          <LiveText
            testId={`${testIdPrefix}stat-to-level`}
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
        <PerHourValue value={player.profitPerHour} testId={`${testIdPrefix}stat-per-hour`} />
        <IncomeBoostBadge until={player.incomeBoostUntil} serverTime={player.serverTime} />
      </StatTile>
    </div>
  );
}
