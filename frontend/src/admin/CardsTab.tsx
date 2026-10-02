import {
  CARD_BADGE_LABELS,
  CARD_CATEGORIES,
  CARD_GLYPHS,
  CARD_ICON_BADGES,
  CARD_PALETTES,
  CARD_TEXT_BADGES,
  formatInt,
  formatShort,
  isTextBadge,
  type AdminCard,
  type AdminCardCondition,
  type AdminCardInput,
  type CardBadge,
  type CardPreviewResponse,
} from '@meowgul/shared';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { CardArt, CardIcon } from '../components/cards/CardIcon';
import { Toggle } from '../components/Toggle';
import { useGame } from '../store/game';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt, confirmAction, fromLocalInput, toLocalInput } from './helpers';
import { Badge, Empty, Field, NumberInput, Panel, Select, TextArea, TextInput } from './ui';

const BLANK: AdminCardInput = {
  category: 'MARKETS',
  nameRu: '',
  nameEn: '',
  descRu: '',
  descEn: '',
  icon: 'rocket/none/0',
  baseCost: 1_000,
  baseProfit: 120,
  costMultiplier: 1.9,
  profitMultiplier: 1.1,
  maxLevel: 20,
  cooldownSec: 0,
  condition: null,
  isLimited: false,
  availableFrom: null,
  availableUntil: null,
  isActive: true,
  sortOrder: 100,
};

const BADGES: readonly CardBadge[] = [...CARD_ICON_BADGES, ...CARD_TEXT_BADGES];

function badgeLabel(b: CardBadge): string {
  return isTextBadge(b) ? (CARD_BADGE_LABELS[b] ?? b) : b;
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const a = useA();
  const [glyph = 'rocket', badge = 'none', palette = '0'] = value.split('/');
  const set = (g: string, b: string, p: string) => onChange(`${g}/${b}/${p}`);
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
      <CardIcon icon={value} size={72} className="shrink-0" />
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <Field label={a('cards.glyph')}>
          <Select
            value={glyph}
            onChange={(e) => set(e.target.value, badge, palette)}
            data-testid="admin-card-glyph"
          >
            {CARD_GLYPHS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={a('cards.badge')}>
          <Select value={badge} onChange={(e) => set(glyph, e.target.value, palette)}>
            {BADGES.map((b) => (
              <option key={b} value={b}>
                {badgeLabel(b)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <span className="text-xs font-bold text-white/55">{a('cards.palette')}</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CARD_PALETTES.map(([light, dark], i) => (
              <button
                key={i}
                type="button"
                aria-label={`palette ${i}`}
                aria-pressed={String(i) === palette}
                onClick={() => set(glyph, badge, String(i))}
                className={`h-7 w-7 rounded-lg ${String(i) === palette ? 'ring-2 ring-white' : ''}`}
                style={{ background: `linear-gradient(135deg, ${light}, ${dark})` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConditionEditor({
  value,
  onChange,
  cards,
}: {
  value: AdminCardCondition | null;
  onChange: (c: AdminCardCondition | null) => void;
  cards: AdminCard[];
}) {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const leagues = useGame((s) => s.config?.leagues ?? []);
  const type = value?.type ?? 'none';
  const change = (t: string) => {
    if (t === 'none') onChange(null);
    if (t === 'card') onChange({ type: 'card', cardId: cards[0]?.id ?? '', level: 1 });
    if (t === 'friends') onChange({ type: 'friends', count: 1 });
    if (t === 'task') onChange({ type: 'task', taskId: 'tg_channel' });
    if (t === 'league') onChange({ type: 'league', level: 1 });
  };
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Field label={a('cards.condition')}>
        <Select value={type} onChange={(e) => change(e.target.value)} data-testid="admin-card-condition">
          {(['none', 'card', 'friends', 'task', 'league'] as const).map((t) => (
            <option key={t} value={t}>
              {a(`cards.cond.${t}`)}
            </option>
          ))}
        </Select>
      </Field>
      {value?.type === 'card' && (
        <>
          <Field label={a('cards.condCard')}>
            <Select value={value.cardId} onChange={(e) => onChange({ ...value, cardId: e.target.value })}>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ru' ? c.nameRu : c.nameEn} ({c.id})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={a('cards.condLevel')}>
            <NumberInput
              value={value.level}
              step={1}
              onChange={(v) => onChange({ ...value, level: v ?? 1 })}
            />
          </Field>
        </>
      )}
      {value?.type === 'friends' && (
        <Field label={a('cards.cond.friends')}>
          <NumberInput value={value.count} step={1} onChange={(v) => onChange({ ...value, count: v ?? 1 })} />
        </Field>
      )}
      {value?.type === 'task' && (
        <Field label="taskId">
          <TextInput
            value={value.taskId}
            onChange={(e) => onChange({ ...value, taskId: e.target.value.trim() })}
          />
        </Field>
      )}
      {value?.type === 'league' && (
        <Field label={a('cards.cond.league')}>
          <Select value={value.level} onChange={(e) => onChange({ ...value, level: Number(e.target.value) })}>
            {leagues.slice(1).map((l) => (
              <option key={l.level} value={l.level}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}

function CardEditor({
  card,
  cards,
  onClose,
  onSaved,
}: {
  card: AdminCard | null;
  cards: AdminCard[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [id, setId] = useState(card?.id ?? '');
  const [form, setForm] = useState<AdminCardInput>(() => {
    if (!card) return BLANK;
    const { id: _id, owners: _owners, ...input } = card;
    return input;
  });
  const [preview, setPreview] = useState<CardPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof AdminCardInput>(key: K, value: AdminCardInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // превью экономики пересчитывает сервер (те же формулы, что в игре)
  useEffect(() => {
    const t = window.setTimeout(() => {
      void adminApi
        .previewCard(card?.id ?? (/^[a-z0-9_]{2,40}$/.test(id) ? id : undefined), form)
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => window.clearTimeout(t);
  }, [form, id, card?.id]);

  const save = async () => {
    setBusy(true);
    const res = await attempt(() =>
      card ? adminApi.updateCard(card.id, form) : adminApi.createCard(id, form),
    );
    setBusy(false);
    if (!res) return;
    toast.success(a('saved'));
    onSaved();
  };

  const remove = async () => {
    if (!card || !(await confirmAction(`${a('delete')} ${card.id}?`))) return;
    const res = await attempt(() => adminApi.deleteCard(card.id));
    if (res) {
      toast.success(a('saved'));
      onSaved();
    }
  };

  const num =
    (
      key:
        | 'baseCost'
        | 'baseProfit'
        | 'costMultiplier'
        | 'profitMultiplier'
        | 'maxLevel'
        | 'cooldownSec'
        | 'sortOrder',
    ) =>
    (v: number | null) =>
      set(key, v ?? 0);

  return (
    <div className="flex flex-col gap-3" data-testid="admin-card-editor">
      <button type="button" onClick={onClose} className="self-start text-sm font-extrabold text-violet">
        {a('back')}
      </button>
      <Panel
        title={card ? card.id : a('cards.new')}
        actions={
          card && (
            <Badge>
              {card.owners} {a('cards.owners')}
            </Badge>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {!card && (
            <Field label={a('cards.id')}>
              <TextInput
                value={id}
                onChange={(e) => setId(e.target.value.trim())}
                placeholder="mk_new_card"
                data-testid="admin-card-id"
              />
            </Field>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={a('cards.nameRu')}>
              <TextInput
                value={form.nameRu}
                onChange={(e) => set('nameRu', e.target.value)}
                data-testid="admin-card-name-ru"
              />
            </Field>
            <Field label={a('cards.nameEn')}>
              <TextInput
                value={form.nameEn}
                onChange={(e) => set('nameEn', e.target.value)}
                data-testid="admin-card-name-en"
              />
            </Field>
            <Field label={a('cards.descRu')}>
              <TextArea value={form.descRu} onChange={(e) => set('descRu', e.target.value)} />
            </Field>
            <Field label={a('cards.descEn')}>
              <TextArea value={form.descEn} onChange={(e) => set('descEn', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label={a('cards.category')}>
              <Select
                value={form.category}
                onChange={(e) => set('category', e.target.value as AdminCardInput['category'])}
              >
                {CARD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={a('cards.sortOrder')}>
              <NumberInput value={form.sortOrder} step={1} onChange={num('sortOrder')} />
            </Field>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm font-bold">
                <Toggle
                  label={a('cards.active')}
                  checked={form.isActive}
                  onChange={(v) => set('isActive', v)}
                />
                {a('cards.active')}
              </label>
            </div>
          </div>
          <Field label={a('cards.icon')}>
            <IconPicker value={form.icon} onChange={(icon) => set('icon', icon)} />
          </Field>
          {form.category === 'SPECIALS' && (
            <div className="overflow-hidden rounded-2xl">
              <CardArt icon={form.icon} seed={id || 'preview'} className="h-36 w-full" />
            </div>
          )}
        </div>
      </Panel>

      <Panel title={a('cards.preview')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label={a('cards.baseCost')}>
            <NumberInput
              value={form.baseCost}
              step={1}
              onChange={num('baseCost')}
              data-testid="admin-card-cost"
            />
          </Field>
          <Field label={a('cards.baseProfit')}>
            <NumberInput
              value={form.baseProfit}
              step={1}
              onChange={num('baseProfit')}
              data-testid="admin-card-profit"
            />
          </Field>
          <Field label={a('cards.costMultiplier')}>
            <NumberInput value={form.costMultiplier} step={0.05} onChange={num('costMultiplier')} />
          </Field>
          <Field label={a('cards.profitMultiplier')}>
            <NumberInput value={form.profitMultiplier} step={0.01} onChange={num('profitMultiplier')} />
          </Field>
          <Field label={a('cards.maxLevel')}>
            <NumberInput value={form.maxLevel} step={1} onChange={num('maxLevel')} />
          </Field>
          <Field label={a('cards.cooldown')}>
            <NumberInput value={form.cooldownSec} step={60} onChange={num('cooldownSec')} />
          </Field>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-white/40">{a('cards.profitNote')}</p>
        {preview && (
          <>
            <div
              className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${preview.warnings.length ? 'bg-gold/10 text-gold' : 'bg-lime/10 text-lime'}`}
              data-testid="admin-card-warnings"
            >
              {preview.warnings.length
                ? preview.warnings.map((w) => <p key={w}>⚠ {w}</p>)
                : `✓ ${a('cards.ok')}`}
            </div>
            <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-right text-xs tabular" data-testid="admin-card-levels">
                <thead className="sticky top-0 bg-night-800 text-white/50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">{a('cards.level')}</th>
                    <th className="px-2 py-1.5">{a('cards.cost')}</th>
                    <th className="px-2 py-1.5">{a('cards.profit')}</th>
                    <th className="px-2 py-1.5">{a('cards.total')}</th>
                    <th className="px-2 py-1.5">{a('cards.payback')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-bold">
                  {preview.levels.map((l) => (
                    <tr key={l.level}>
                      <td className="px-2 py-1 text-left text-white/60">{l.level}</td>
                      <td className="px-2 py-1">{formatShort(l.cost, locale)}</td>
                      <td className="px-2 py-1 text-lime">+{formatShort(l.profit, locale)}</td>
                      <td className="px-2 py-1">{formatShort(l.totalProfit, locale)}</td>
                      <td className="px-2 py-1">
                        {formatInt(Math.round(l.paybackHours))} {a('cards.hours')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Panel title={a('cards.condition')}>
        <ConditionEditor
          value={form.condition}
          onChange={(c) => set('condition', c)}
          cards={cards.filter((c) => c.id !== card?.id)}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <Toggle
              label={a('cards.isLimited')}
              checked={form.isLimited}
              onChange={(v) => set('isLimited', v)}
            />
            {a('cards.isLimited')}
          </label>
          <Field label={a('cards.from')} hint={a('cards.windowHint')}>
            <TextInput
              type="datetime-local"
              value={toLocalInput(form.availableFrom)}
              onChange={(e) => set('availableFrom', fromLocalInput(e.target.value))}
            />
          </Field>
          <Field label={a('cards.until')}>
            <TextInput
              type="datetime-local"
              value={toLocalInput(form.availableUntil)}
              onChange={(e) => set('availableUntil', fromLocalInput(e.target.value))}
            />
          </Field>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 px-6"
          loading={busy}
          onClick={() => void save()}
          data-testid="admin-card-save"
        >
          {card ? a('save') : a('create')}
        </Button>
        {card && (
          <Button
            variant="danger"
            className="h-11 px-5"
            disabled={card.owners > 0}
            onClick={() => void remove()}
            title={a('cards.deleteHint')}
          >
            {a('delete')}
          </Button>
        )}
      </div>
      {card && card.owners > 0 && (
        <p className="text-xs font-semibold text-white/40">{a('cards.deleteHint')}</p>
      )}
    </div>
  );
}

export function CardsTab() {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [cards, setCards] = useState<AdminCard[] | null>(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [editing, setEditing] = useState<AdminCard | 'new' | null>(null);

  const load = () => void attempt(() => adminApi.cards()).then((res) => res && setCards(res.cards));
  useEffect(load, []);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (cards ?? []).filter(
      (c) =>
        (category === 'ALL' || c.category === category) &&
        (!f || c.id.includes(f) || c.nameRu.toLowerCase().includes(f) || c.nameEn.toLowerCase().includes(f)),
    );
  }, [cards, filter, category]);

  if (editing) {
    return (
      <CardEditor
        card={editing === 'new' ? null : editing}
        cards={cards ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3" data-testid="admin-cards">
      <div className="flex flex-wrap gap-2">
        <TextInput
          className="min-w-[160px] flex-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={a('cards.filter')}
        />
        <Select className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="ALL">ALL</option>
          {CARD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Button className="h-10 px-4 text-sm" onClick={() => setEditing('new')} data-testid="admin-card-new">
          + {a('cards.new')}
        </Button>
      </div>
      <Panel title={`${shown.length}`}>
        {!cards ? (
          <div className="skeleton h-60 rounded-xl" />
        ) : shown.length === 0 ? (
          <Empty>—</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {shown.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditing(c)}
                className="flex w-full items-center gap-3 py-2 text-left"
                data-testid={`admin-card-${c.id}`}
              >
                <CardIcon icon={c.icon} size={40} muted={!c.isActive} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-extrabold">
                    <span className="truncate">{locale === 'ru' ? c.nameRu : c.nameEn}</span>
                    {!c.isActive && <Badge tone="bad">{a('cards.inactive')}</Badge>}
                    {c.isLimited && <Badge tone="warn">{a('cards.limited')}</Badge>}
                  </span>
                  <span className="block truncate text-xs font-semibold text-white/45">
                    {c.id} · {formatShort(c.baseCost, locale)} → +{formatShort(c.baseProfit, locale)}/h · ×
                    {c.costMultiplier}/×{c.profitMultiplier} · {c.maxLevel} lvl
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-white/50">
                  {formatInt(c.owners)} {a('cards.owners')}
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
