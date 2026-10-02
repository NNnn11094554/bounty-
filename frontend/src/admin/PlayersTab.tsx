import { formatInt, formatShort, type AdminPlayerDetails, type AdminPlayerRow } from '@meowgul/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { useGame } from '../store/game';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt, confirmAction, formatDateTime } from './helpers';
import { Badge, Empty, Field, NumberInput, Panel, TextInput } from './ui';

function PlayerRow({ p, onOpen }: { p: AdminPlayerRow; onOpen: () => void }) {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const leagues = useGame((s) => s.config?.leagues ?? []);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 py-2.5 text-left"
      data-testid="admin-player-row"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-sm font-extrabold">
          <span className="truncate">{p.name}</span>
          {p.username && <span className="truncate text-white/45">@{p.username}</span>}
          {p.isBanned && <Badge tone="bad">{a('players.banned')}</Badge>}
          {p.suspiciousScore > 0 && (
            <Badge tone="warn">
              {a('players.score')} {p.suspiciousScore}
            </Badge>
          )}
        </span>
        <span className="block truncate text-xs font-semibold text-white/45">
          #{p.id} · tg {p.telegramId} · {leagues[p.leagueLevel]?.name ?? p.leagueLevel}
        </span>
      </span>
      <span className="shrink-0 text-right text-sm font-black tabular">
        {formatShort(p.balance, locale)}
        <span className="block text-[11px] font-bold text-white/40">
          +{formatShort(p.profitPerHour, locale)}/h
        </span>
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-bold text-white/45">{label}</p>
      <p className="truncate text-sm font-extrabold tabular">{value}</p>
    </div>
  );
}

function PlayerDetails({ id, onBack }: { id: number; onBack: () => void }) {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const leagues = useGame((s) => s.config?.leagues ?? []);
  const [p, setP] = useState<AdminPlayerDetails | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [banReason, setBanReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void attempt(() => adminApi.player(id)).then((res) => res && setP(res));
  }, [id]);

  const act = async (fn: () => Promise<AdminPlayerDetails>) => {
    setBusy(true);
    const res = await attempt(fn);
    setBusy(false);
    if (res) {
      setP(res);
      toast.success(a('saved'));
    }
    return res;
  };

  const more = async () => {
    if (!p?.nextBefore) return;
    const res = await attempt(() => adminApi.player(id, p.nextBefore!));
    if (res) setP({ ...res, transactions: [...p.transactions, ...res.transactions] });
  };

  if (!p) return <div className="skeleton h-64 rounded-[20px]" />;
  const dt = (ms: number) => formatDateTime(ms, locale);
  return (
    <div className="flex flex-col gap-3" data-testid="admin-player">
      <button type="button" onClick={onBack} className="self-start text-sm font-extrabold text-violet">
        {a('back')}
      </button>
      <Panel
        title={
          <span className="flex items-center gap-2">
            {p.name} {p.username && <span className="text-white/45">@{p.username}</span>}
            {p.isPremium && <span className="text-gold">★</span>}
            {p.isBanned && <Badge tone="bad">{a('players.banned')}</Badge>}
          </span>
        }
      >
        <p className="mb-3 text-xs font-semibold text-white/45">
          #{p.id} · tg {p.telegramId} · {p.languageCode}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info label={a('players.balance')} value={formatInt(p.balance)} />
          <Info label={a('players.earned')} value={formatInt(p.totalEarned)} />
          <Info label={a('players.pph')} value={formatInt(p.profitPerHour)} />
          <Info label={a('players.league')} value={leagues[p.leagueLevel]?.name ?? p.leagueLevel} />
          <Info label={a('players.taps')} value={formatInt(p.totalTaps)} />
          <Info label={a('players.boosts')} value={`${p.multitapLevel} / ${p.energyLimitLevel}`} />
          <Info label={a('players.friends')} value={p.friends} />
          <Info label={a('players.achievements')} value={p.achievements} />
          <Info
            label={a('players.referrer')}
            value={p.referrer ? `${p.referrer.name} #${p.referrer.id}` : '—'}
          />
          <Info label={a('players.wallet')} value={p.walletAddress ?? '—'} />
          <Info label={a('players.created')} value={dt(p.createdAt)} />
          <Info label={a('players.seen')} value={dt(p.lastSeenAt)} />
        </div>
        {p.banReason && <p className="mt-3 text-sm font-bold text-[#ff8a95]">{p.banReason}</p>}
      </Panel>

      <Panel title={a('players.purchases')}>
        {p.purchases.length === 0 ? (
          <Empty>{a('players.noPurchases')}</Empty>
        ) : (
          <div className="divide-y divide-white/5" data-testid="admin-purchases">
            {p.purchases.map((pu) => (
              <div key={pu.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">
                  {pu.productId} · {pu.stars} ⭐
                  <span className="ml-2 text-xs font-semibold text-white/45">
                    {dt(pu.paidAt ?? pu.createdAt)}
                  </span>
                </span>
                {pu.status === 'REFUNDED' ? (
                  <Badge tone="warn">{a('players.refunded')}</Badge>
                ) : (
                  <Button
                    variant="danger"
                    className="h-8 px-3 text-xs"
                    loading={busy}
                    onClick={() =>
                      void (async () => {
                        if (!(await confirmAction(a('players.confirmRefund', { stars: pu.stars })))) return;
                        await act(() => adminApi.refund(pu.id));
                      })()
                    }
                  >
                    {a('players.refund')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={a('players.credit')}>
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
          <NumberInput
            value={amount}
            onChange={setAmount}
            step={1}
            placeholder="1000"
            data-testid="admin-credit-amount"
          />
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={a('players.reason')}
            data-testid="admin-credit-reason"
          />
          <Button
            className="h-10 px-4 text-sm"
            loading={busy}
            disabled={!amount || reason.trim().length < 3}
            onClick={async () => {
              if (!amount) return;
              if (
                !(await confirmAction(
                  a('players.confirmCredit', { amount: formatInt(amount), name: p.name }),
                ))
              )
                return;
              const r = await act(() => adminApi.credit(p.id, amount, reason.trim()));
              if (r) {
                setAmount(null);
                setReason('');
              }
            }}
            data-testid="admin-credit-apply"
          >
            {a('players.apply')}
          </Button>
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-end gap-2">
          {p.isBanned ? (
            <Button
              className="h-10 px-4 text-sm"
              loading={busy}
              onClick={() => void act(() => adminApi.unban(p.id))}
            >
              {a('players.unban')}
            </Button>
          ) : (
            <>
              <div className="min-w-[200px] flex-1">
                <Field label={a('players.banReason')}>
                  <TextInput
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    data-testid="admin-ban-reason"
                  />
                </Field>
              </div>
              <Button
                variant="danger"
                className="h-10 px-4 text-sm"
                loading={busy}
                disabled={banReason.trim().length < 3}
                onClick={async () => {
                  if (!(await confirmAction(a('players.confirmBan', { name: p.name })))) return;
                  await act(() => adminApi.ban(p.id, banReason.trim()));
                }}
                data-testid="admin-ban"
              >
                {a('players.ban')}
              </Button>
            </>
          )}
          {p.suspiciousScore > 0 && !p.isBanned && (
            <Button
              variant="secondary"
              className="h-10 px-4 text-sm"
              loading={busy}
              onClick={() => void act(() => adminApi.clearSuspicion(p.id))}
            >
              {a('players.clear')} ({p.suspiciousScore})
            </Button>
          )}
        </div>
      </Panel>

      <Panel title={a('players.ledger')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <tbody className="divide-y divide-white/5">
              {p.transactions.map((t) => (
                <tr key={t.id} data-testid="admin-tx">
                  <td className="py-1.5 pr-2 font-semibold text-white/45">{dt(t.createdAt)}</td>
                  <td className="py-1.5 pr-2 font-extrabold">
                    {t.type}
                    {t.count > 1 && <span className="text-white/40"> ×{t.count}</span>}
                  </td>
                  <td
                    className={`py-1.5 pr-2 text-right font-black tabular ${t.amount < 0 ? 'text-[#ff8a95]' : 'text-lime'}`}
                  >
                    {t.amount > 0 ? '+' : ''}
                    {formatInt(Math.trunc(t.amount))}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-bold tabular text-white/55">
                    {formatInt(t.balanceAfter)}
                  </td>
                  <td className="max-w-[220px] truncate py-1.5 font-semibold text-white/40">
                    {t.meta ? JSON.stringify(t.meta) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.nextBefore && (
          <Button variant="secondary" block className="mt-3 h-10 text-sm" onClick={() => void more()}>
            {a('players.more')}
          </Button>
        )}
      </Panel>
    </div>
  );
}

export function PlayersTab() {
  const a = useA();
  const [q, setQ] = useState('');
  const [suspicious, setSuspicious] = useState(false);
  const [rows, setRows] = useState<AdminPlayerRow[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open !== null) return;
    const id = window.setTimeout(
      () =>
        void attempt(() => (suspicious ? adminApi.suspicious() : adminApi.players(q.trim()))).then(
          (res) => res && setRows(res.players),
        ),
      suspicious ? 0 : 300,
    );
    return () => window.clearTimeout(id);
  }, [q, suspicious, open]);

  if (open !== null) return <PlayerDetails id={open} onBack={() => setOpen(null)} />;
  return (
    <div className="flex flex-col gap-3" data-testid="admin-players">
      <div className="flex gap-2">
        <TextInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSuspicious(false);
          }}
          placeholder={a('players.placeholder')}
          data-testid="admin-player-search"
        />
        <Button
          variant={suspicious ? 'primary' : 'secondary'}
          className="h-10 shrink-0 px-3 text-sm"
          onClick={() => setSuspicious((v) => !v)}
          data-testid="admin-suspicious"
        >
          {a('players.suspicious')}
        </Button>
      </div>
      <Panel>
        {rows === null ? (
          <div className="skeleton h-40 rounded-xl" />
        ) : rows.length === 0 ? (
          <Empty>{a('players.empty')}</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {rows.map((p) => (
              <PlayerRow key={p.id} p={p} onOpen={() => setOpen(p.id)} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
