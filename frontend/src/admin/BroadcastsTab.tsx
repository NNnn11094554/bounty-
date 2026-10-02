import { formatInt, type AdminBroadcast, type AdminBroadcastInput } from '@meowgul/shared';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale, type AdminKey } from './i18n';
import { attempt, confirmAction, formatDateTime } from './helpers';
import { Badge, Empty, Field, Panel, TextArea, TextInput } from './ui';

const BLANK: AdminBroadcastInput = { text: '', imageUrl: null, buttonText: null, buttonUrl: null };
const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** Примерный вид сообщения в Telegram: картинка, текст, кнопка. */
function MessagePreview({ b }: { b: AdminBroadcastInput }) {
  return (
    <div className="max-w-[320px] overflow-hidden rounded-2xl rounded-bl-md bg-[#2b5278] text-sm shadow-card">
      {b.imageUrl && <img src={b.imageUrl} alt="" className="max-h-48 w-full object-cover" />}
      <p className="whitespace-pre-wrap break-words px-3 py-2 font-semibold leading-snug">{b.text || '…'}</p>
      {b.buttonText && (
        <div className="m-1 mt-0 rounded-xl bg-white/10 px-3 py-2 text-center font-bold">{b.buttonText}</div>
      )}
    </div>
  );
}

function statusTone(s: AdminBroadcast['status']) {
  return s === 'RUNNING' ? 'good' : s === 'PAUSED' ? 'warn' : s === 'CANCELLED' ? 'bad' : 'neutral';
}

export function BroadcastsTab() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [list, setList] = useState<AdminBroadcast[] | null>(null);
  const [audience, setAudience] = useState(0);
  const [form, setForm] = useState<AdminBroadcastInput>(BLANK);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      void attempt(() => adminApi.broadcasts()).then((res) => {
        if (!res) return;
        setList(res.broadcasts);
        setAudience(res.audience);
      }),
    [],
  );
  useEffect(load, [load]);
  // пока рассылка идёт — прогресс обновляется сам
  const running = list?.some((b) => b.status === 'RUNNING');
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(load, 3000);
    return () => window.clearInterval(id);
  }, [running, load]);

  const create = async () => {
    setBusy(true);
    const res = await attempt(() => adminApi.createBroadcast(form));
    setBusy(false);
    if (res) {
      setForm(BLANK);
      toast.success(a('saved'));
      load();
    }
  };

  const action = async (b: AdminBroadcast, act: 'test' | 'start' | 'pause' | 'resume' | 'cancel') => {
    if (act === 'start' && !(await confirmAction(a('bc.confirmStart', { n: formatInt(audience) })))) return;
    if (act === 'cancel' && !(await confirmAction(`${a('bc.cancelIt')}?`))) return;
    const res = await attempt(() => adminApi.broadcastAction(b.id, act));
    if (!res) return;
    toast.success(act === 'test' ? a('bc.testSent') : a('saved'));
    load();
  };

  return (
    <div className="flex flex-col gap-3" data-testid="admin-broadcasts">
      <Panel title={a('bc.new')}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 flex-col gap-2">
            <Field label={a('bc.text')} hint={`${form.text.length} / ${form.imageUrl ? 1024 : 4096}`}>
              <TextArea
                rows={5}
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                data-testid="admin-bc-text"
              />
            </Field>
            <Field label={a('bc.image')}>
              <TextInput
                value={form.imageUrl ?? ''}
                onChange={(e) => setForm({ ...form, imageUrl: orNull(e.target.value) })}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={a('bc.buttonText')}>
                <TextInput
                  value={form.buttonText ?? ''}
                  onChange={(e) => setForm({ ...form, buttonText: orNull(e.target.value) })}
                />
              </Field>
              <Field label={a('bc.buttonUrl')}>
                <TextInput
                  value={form.buttonUrl ?? ''}
                  onChange={(e) => setForm({ ...form, buttonUrl: orNull(e.target.value) })}
                />
              </Field>
            </div>
            <p className="text-xs font-bold text-white/50">{a('bc.audience', { n: formatInt(audience) })}</p>
            <Button
              className="h-10 self-start px-4 text-sm"
              loading={busy}
              disabled={!form.text.trim()}
              onClick={() => void create()}
              data-testid="admin-bc-create"
            >
              {a('bc.draft')}
            </Button>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-white/55">{a('bc.preview')}</p>
            <MessagePreview b={form} />
          </div>
        </div>
      </Panel>

      {list === null ? (
        <div className="skeleton h-32 rounded-[20px]" />
      ) : list.length === 0 ? (
        <Panel>
          <Empty>{a('bc.empty')}</Empty>
        </Panel>
      ) : (
        list.map((b) => {
          const done = b.sent + b.failed;
          const ratio = b.total ? Math.min(1, done / b.total) : 0;
          return (
            <Panel
              key={b.id}
              title={
                <span className="flex items-center gap-2">
                  #{b.id}
                  <Badge tone={statusTone(b.status)}>{a(`bc.status.${b.status}` as AdminKey)}</Badge>
                  <span className="text-xs font-semibold text-white/40">
                    {formatDateTime(b.createdAt, locale)}
                  </span>
                </span>
              }
            >
              <div data-testid="admin-bc-item" data-status={b.status}>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm font-semibold text-white/80">
                  {b.text}
                </p>
                {b.status !== 'DRAFT' && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full origin-left rounded-full bg-progress transition-transform duration-500"
                        style={{ transform: `scaleX(${ratio})` }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-bold text-white/55" data-testid="admin-bc-progress">
                      {a('bc.progress', {
                        sent: formatInt(b.sent),
                        total: formatInt(b.total),
                        failed: formatInt(b.failed),
                      })}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === 'DRAFT' && (
                    <>
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-sm"
                        onClick={() => void action(b, 'test')}
                      >
                        {a('bc.test')}
                      </Button>
                      <Button
                        className="h-9 px-3 text-sm"
                        onClick={() => void action(b, 'start')}
                        data-testid="admin-bc-start"
                      >
                        {a('bc.start')}
                      </Button>
                    </>
                  )}
                  {b.status === 'RUNNING' && (
                    <Button
                      variant="secondary"
                      className="h-9 px-3 text-sm"
                      onClick={() => void action(b, 'pause')}
                      data-testid="admin-bc-pause"
                    >
                      {a('bc.pause')}
                    </Button>
                  )}
                  {b.status === 'PAUSED' && (
                    <Button className="h-9 px-3 text-sm" onClick={() => void action(b, 'resume')}>
                      {a('bc.resume')}
                    </Button>
                  )}
                  {['DRAFT', 'RUNNING', 'PAUSED'].includes(b.status) && (
                    <Button
                      variant="danger"
                      className="h-9 px-3 text-sm"
                      onClick={() => void action(b, 'cancel')}
                    >
                      {a('bc.cancelIt')}
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          );
        })
      )}
    </div>
  );
}
