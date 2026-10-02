import { formatInt, formatShort, type AdminStats } from '@meowgul/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt } from './helpers';
import { Empty, Kpi, Panel } from './ui';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 1000) / 10}%`);

/** Столбики за 14 дней: активные и новые игроки. */
function DaysChart({ days }: { days: AdminStats['days'] }) {
  const a = useA();
  const max = Math.max(1, ...days.map((d) => Math.max(d.active, d.registered)));
  const w = 100 / days.length;
  return (
    <div>
      <svg
        viewBox="0 0 100 44"
        className="h-44 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={a('stats.chart')}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2="100"
            y1={40 - 38 * f}
            y2={40 - 38 * f}
            stroke="#fff"
            strokeOpacity="0.06"
            strokeWidth="0.2"
          />
        ))}
        {days.map((d, i) => {
          const ha = (38 * d.active) / max;
          const hr = (38 * d.registered) / max;
          return (
            <g key={d.dayKey}>
              <rect x={i * w + w * 0.12} y={40 - ha} width={w * 0.38} height={ha} rx="0.6" fill="#2ed3c6">
                <title>{`${d.dayKey}: ${d.active}`}</title>
              </rect>
              <rect x={i * w + w * 0.52} y={40 - hr} width={w * 0.38} height={hr} rx="0.6" fill="#ff8a3d">
                <title>{`${d.dayKey}: +${d.registered}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-white/40">
        <span>{days[0]?.dayKey.slice(5)}</span>
        <span>{days.at(-1)?.dayKey.slice(5)}</span>
      </div>
      <div className="mt-2 flex gap-4 text-xs font-bold text-white/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal" />
          {a('stats.active')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-coral-from" />
          {a('stats.registered')}
        </span>
      </div>
    </div>
  );
}

export function StatsTab() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await attempt(() => adminApi.stats());
    if (res) setStats(res);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-[62px] rounded-2xl" />
        ))}
      </div>
    );
  }
  const n = (v: number) => formatInt(v);
  return (
    <div className="flex flex-col gap-3" data-testid="admin-stats">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-bold text-white/40">
          {a('stats.updated', {
            time: new Date(stats.generatedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-GB'),
          })}
        </p>
        <Button
          variant="secondary"
          className="h-9 px-3 text-sm"
          loading={loading}
          onClick={() => void load()}
        >
          {a('refresh')}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={a('stats.players')} value={n(stats.players)} />
        <Kpi label={a('stats.newToday')} value={n(stats.newToday)} />
        <Kpi label={a('stats.dau')} value={n(stats.dau)} />
        <Kpi label={a('stats.wau')} value={n(stats.wau)} />
        <Kpi label={a('stats.mau')} value={n(stats.mau)} />
        <Kpi label={a('stats.d1')} value={pct(stats.retention.d1)} hint={a('stats.retentionHint')} />
        <Kpi label={a('stats.d7')} value={pct(stats.retention.d7)} hint={a('stats.retentionHint')} />
        <Kpi label={a('stats.d30')} value={pct(stats.retention.d30)} hint={a('stats.retentionHint')} />
        <Kpi label={a('stats.balance')} value={formatShort(stats.coins.balance, locale)} />
        <Kpi label={a('stats.earned')} value={formatShort(stats.coins.earned, locale)} />
        <Kpi label={a('stats.banned')} value={n(stats.banned)} />
        <Kpi label={a('stats.suspicious')} value={n(stats.suspicious)} />
        <Kpi label={a('stats.queue')} value={n(stats.pendingNotifications)} />
      </div>
      <Panel title={a('stats.chart')}>
        <DaysChart days={stats.days} />
      </Panel>
      <Panel title={a('stats.referrers')}>
        {stats.topReferrers.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <ol className="flex flex-col divide-y divide-white/5">
            {stats.topReferrers.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-right font-black text-white/40">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {r.name} {r.username && <span className="text-white/45">@{r.username}</span>}
                </span>
                <span className="font-extrabold text-gold">
                  {n(r.friends)} {a('stats.friends')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
