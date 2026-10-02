import type { AdminSettings } from '@meowgul/shared';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Toggle } from '../components/Toggle';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt, formatDateTime, fromLocalInput, toLocalInput } from './helpers';
import { Field, NumberInput, Panel, TextArea, TextInput } from './ui';

type Editable = Omit<AdminSettings, 'nextHappyHour'>;

export function SettingsTab() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [saved, setSaved] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState<Editable | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = (s: AdminSettings) => {
    setSaved(s);
    const { nextHappyHour: _n, ...editable } = s;
    setForm(editable);
  };
  useEffect(() => {
    void attempt(() => adminApi.settings()).then((s) => s && apply(s));
  }, []);

  const save = async (patch: Partial<Editable>) => {
    setBusy(true);
    const res = await attempt(() => adminApi.saveSettings(patch));
    setBusy(false);
    if (res) {
      apply(res);
      toast.success(a('saved'));
    }
  };

  if (!form || !saved) return <div className="skeleton h-64 rounded-[20px]" />;
  const hh = form.happyHour;
  const override = hh.override;
  const next = saved.nextHappyHour;
  return (
    <div className="flex flex-col gap-3" data-testid="admin-settings">
      <Panel
        title={a('set.maintenance')}
        actions={
          <Toggle
            label={a('set.maintenance')}
            checked={form.maintenance.enabled}
            onChange={(enabled) => void save({ maintenance: { ...form.maintenance, enabled } })}
            testId="admin-maintenance"
          />
        }
      >
        <p className="mb-2 text-xs font-semibold text-white/45">{a('set.maintenanceHint')}</p>
        <Field label={a('set.message')}>
          <TextArea
            value={form.maintenance.message}
            onChange={(e) =>
              setForm({ ...form, maintenance: { ...form.maintenance, message: e.target.value } })
            }
          />
        </Field>
        <Button
          variant="secondary"
          className="mt-2 h-9 px-4 text-sm"
          loading={busy}
          onClick={() => void save({ maintenance: form.maintenance })}
        >
          {a('save')}
        </Button>
      </Panel>

      <Panel title={a('set.happyHour')}>
        <p className="mb-3 text-sm font-bold text-lime" data-testid="admin-next-hh">
          {next
            ? a('set.next', {
                from: formatDateTime(next.startsAt, locale),
                to: formatDateTime(next.endsAt, locale),
                x: next.multiplier,
              })
            : a('set.noNext')}
        </p>
        <label className="flex items-center gap-2 text-sm font-bold">
          <Toggle
            label={a('set.auto')}
            checked={hh.auto}
            onChange={(auto) => setForm({ ...form, happyHour: { ...hh, auto } })}
          />
          {a('set.auto')}
        </label>
        <p className="mb-2 mt-4 text-sm font-extrabold">{a('set.override')}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={a('set.start')}>
            <TextInput
              type="datetime-local"
              value={toLocalInput(override ? Date.parse(override.startsAt) : null)}
              onChange={(e) => {
                const start = fromLocalInput(e.target.value);
                if (start === null) return;
                const end = override ? Date.parse(override.endsAt) : start + 3_600_000;
                setForm({
                  ...form,
                  happyHour: {
                    ...hh,
                    override: {
                      startsAt: new Date(start).toISOString(),
                      endsAt: new Date(Math.max(end, start + 60_000)).toISOString(),
                      multiplier: override?.multiplier ?? 2,
                    },
                  },
                });
              }}
              data-testid="admin-hh-start"
            />
          </Field>
          <Field label={a('set.end')}>
            <TextInput
              type="datetime-local"
              disabled={!override}
              value={toLocalInput(override ? Date.parse(override.endsAt) : null)}
              onChange={(e) => {
                const end = fromLocalInput(e.target.value);
                if (end === null || !override) return;
                setForm({
                  ...form,
                  happyHour: { ...hh, override: { ...override, endsAt: new Date(end).toISOString() } },
                });
              }}
            />
          </Field>
          <Field label={a('set.multiplier')}>
            <NumberInput
              disabled={!override}
              value={override?.multiplier ?? 2}
              step={1}
              min={2}
              max={5}
              onChange={(v) =>
                override &&
                setForm({ ...form, happyHour: { ...hh, override: { ...override, multiplier: v ?? 2 } } })
              }
            />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            className="h-9 px-4 text-sm"
            loading={busy}
            onClick={() => void save({ happyHour: form.happyHour })}
            data-testid="admin-hh-save"
          >
            {a('save')}
          </Button>
          {override && (
            <Button
              variant="secondary"
              className="h-9 px-4 text-sm"
              onClick={() => void save({ happyHour: { ...hh, override: null } })}
            >
              {a('set.clearOverride')}
            </Button>
          )}
        </div>
      </Panel>

      <Panel
        title={a('set.goldenCoin')}
        actions={
          <Toggle
            label={a('set.goldenCoin')}
            checked={form.goldenCoin.enabled}
            onChange={(enabled) => void save({ goldenCoin: { enabled } })}
            testId="admin-golden"
          />
        }
      >
        <p className="text-xs font-semibold text-white/45">{a('set.goldenCoinHint')}</p>
      </Panel>

      <Panel title={a('set.minVersion')}>
        <p className="mb-2 text-xs font-semibold text-white/45">{a('set.minVersionHint')}</p>
        <div className="flex gap-2">
          <TextInput
            value={form.minClientVersion}
            onChange={(e) => setForm({ ...form, minClientVersion: e.target.value.trim() })}
          />
          <Button
            variant="secondary"
            className="h-10 shrink-0 px-4 text-sm"
            loading={busy}
            onClick={() => void save({ minClientVersion: form.minClientVersion })}
          >
            {a('save')}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
