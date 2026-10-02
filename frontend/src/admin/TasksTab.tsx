import {
  formatInt,
  TASK_ICONS,
  TASK_SECTIONS,
  TASK_TYPES,
  type AdminTask,
  type AdminTaskInput,
} from '@meowgul/shared';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { TaskIcon } from '../components/TaskIcon';
import { Toggle } from '../components/Toggle';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt, confirmAction } from './helpers';
import { Badge, Empty, Field, NumberInput, Panel, Select, TextArea, TextInput } from './ui';

const BLANK: AdminTaskInput = {
  id: '',
  type: 'LINK',
  section: 'LIST',
  titleRu: '',
  titleEn: '',
  descRu: '',
  descEn: '',
  icon: 'link',
  imageUrl: null,
  url: null,
  channelId: null,
  requiredCount: null,
  reward: 5_000,
  checkDelaySec: 30,
  sortOrder: 100,
  isActive: true,
};

const orNull = (v: string) => (v.trim() ? v.trim() : null);

function TaskEditor({
  task,
  onClose,
  onSaved,
}: {
  task: AdminTask | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const a = useA();
  const [form, setForm] = useState<AdminTaskInput>(() => {
    if (!task) return BLANK;
    const { completed: _c, ...input } = task;
    return input;
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AdminTaskInput>(key: K, value: AdminTaskInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    const { id: _id, ...body } = form;
    const res = await attempt(() => (task ? adminApi.updateTask(task.id, body) : adminApi.createTask(form)));
    setBusy(false);
    if (res) {
      toast.success(a('saved'));
      onSaved();
    }
  };
  const remove = async () => {
    if (!task || !(await confirmAction(`${a('delete')} ${task.id}?`))) return;
    const res = await attempt(() => adminApi.deleteTask(task.id));
    if (res) {
      toast.success(a(res.result === 'deleted' ? 'tasks.removed' : 'tasks.deactivated'));
      onSaved();
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="admin-task-editor">
      <button type="button" onClick={onClose} className="self-start text-sm font-extrabold text-violet">
        {a('back')}
      </button>
      <Panel title={task ? task.id : a('tasks.new')}>
        <div className="grid gap-2 sm:grid-cols-3">
          {!task && (
            <Field label={a('tasks.id')}>
              <TextInput
                value={form.id}
                onChange={(e) => set('id', e.target.value.trim())}
                placeholder="watch_trailer"
              />
            </Field>
          )}
          <Field label={a('tasks.type')}>
            <Select value={form.type} onChange={(e) => set('type', e.target.value as AdminTaskInput['type'])}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a('tasks.section')}>
            <Select
              value={form.section}
              onChange={(e) => set('section', e.target.value as AdminTaskInput['section'])}
            >
              {TASK_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a('tasks.titleRu')}>
            <TextInput value={form.titleRu} onChange={(e) => set('titleRu', e.target.value)} />
          </Field>
          <Field label={a('tasks.titleEn')}>
            <TextInput value={form.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
          </Field>
          <Field label={a('tasks.icon')}>
            <div className="flex items-center gap-2">
              <TaskIcon icon={form.icon} size={36} />
              <Select
                value={form.icon}
                onChange={(e) => set('icon', e.target.value as AdminTaskInput['icon'])}
              >
                {TASK_ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </Select>
            </div>
          </Field>
          <Field label={a('tasks.descRu')}>
            <TextArea value={form.descRu} onChange={(e) => set('descRu', e.target.value)} />
          </Field>
          <Field label={a('tasks.descEn')}>
            <TextArea value={form.descEn} onChange={(e) => set('descEn', e.target.value)} />
          </Field>
          <Field label={a('tasks.imageUrl')}>
            <TextInput
              value={form.imageUrl ?? ''}
              onChange={(e) => set('imageUrl', orNull(e.target.value))}
            />
          </Field>
          {['LINK', 'VIDEO', 'TELEGRAM_CHANNEL'].includes(form.type) && (
            <Field label={a('tasks.url')}>
              <TextInput value={form.url ?? ''} onChange={(e) => set('url', orNull(e.target.value))} />
            </Field>
          )}
          {form.type === 'TELEGRAM_CHANNEL' && (
            <Field label={a('tasks.channelId')}>
              <TextInput
                value={form.channelId ?? ''}
                onChange={(e) => set('channelId', orNull(e.target.value))}
              />
            </Field>
          )}
          {form.type === 'INVITE_FRIENDS' && (
            <Field label={a('tasks.requiredCount')}>
              <NumberInput value={form.requiredCount} step={1} onChange={(v) => set('requiredCount', v)} />
            </Field>
          )}
          <Field label={a('tasks.reward')}>
            <NumberInput value={form.reward} step={1} onChange={(v) => set('reward', v ?? 0)} />
          </Field>
          <Field label={a('tasks.delay')}>
            <NumberInput value={form.checkDelaySec} step={1} onChange={(v) => set('checkDelaySec', v ?? 0)} />
          </Field>
          <Field label={a('cards.sortOrder')}>
            <NumberInput value={form.sortOrder} step={1} onChange={(v) => set('sortOrder', v ?? 0)} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-1 text-sm font-bold">
            <Toggle label={a('cards.active')} checked={form.isActive} onChange={(v) => set('isActive', v)} />
            {a('cards.active')}
          </label>
        </div>
      </Panel>
      <div className="flex gap-2">
        <Button
          className="h-11 px-6"
          loading={busy}
          onClick={() => void save()}
          data-testid="admin-task-save"
        >
          {task ? a('save') : a('create')}
        </Button>
        {task && (
          <Button variant="danger" className="h-11 px-5" onClick={() => void remove()}>
            {a('delete')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function TasksTab() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [editing, setEditing] = useState<AdminTask | 'new' | null>(null);
  const load = () => void attempt(() => adminApi.tasks()).then((res) => res && setTasks(res.tasks));
  useEffect(load, []);

  if (editing) {
    return (
      <TaskEditor
        task={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="admin-tasks">
      <Button className="h-10 self-start px-4 text-sm" onClick={() => setEditing('new')}>
        + {a('tasks.new')}
      </Button>
      <Panel>
        {!tasks ? (
          <div className="skeleton h-40 rounded-xl" />
        ) : tasks.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setEditing(t)}
                className="flex w-full items-center gap-3 py-2 text-left"
              >
                <TaskIcon icon={t.icon} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-extrabold">
                    <span className="truncate">{locale === 'ru' ? t.titleRu : t.titleEn}</span>
                    {!t.isActive && <Badge tone="bad">{a('cards.inactive')}</Badge>}
                  </span>
                  <span className="block truncate text-xs font-semibold text-white/45">
                    {t.id} · {t.type} · {t.section} · +{formatInt(t.reward)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-white/50">
                  {formatInt(t.completed)} {a('tasks.completed')}
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
