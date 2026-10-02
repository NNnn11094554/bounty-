import type { AdminCard, AdminDailyDay } from '@meowgul/shared';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { CardIcon } from '../components/cards/CardIcon';
import { toast } from '../store/toasts';
import { adminApi } from './api';
import { useA, useAdminLocale } from './i18n';
import { attempt } from './helpers';
import { Badge, Field, Panel, Select, TextInput } from './ui';

function DayEditor({
  day,
  cards,
  isToday,
  onSaved,
}: {
  day: AdminDailyDay;
  cards: AdminCard[];
  isToday: boolean;
  onSaved: () => void;
}) {
  const a = useA();
  const locale = useAdminLocale((s) => s.locale);
  const [combo, setCombo] = useState(day.combo.cardIds);
  const [cipher, setCipher] = useState({
    word: day.cipher.word,
    hintRu: day.cipher.hintRu,
    hintEn: day.cipher.hintEn,
  });
  const [busy, setBusy] = useState<'combo' | 'cipher' | null>(null);
  const name = (c: AdminCard) => (locale === 'ru' ? c.nameRu : c.nameEn);
  const active = cards.filter((c) => c.isActive && !c.isLimited);

  const saveCombo = async () => {
    setBusy('combo');
    const ok = await attempt(() => adminApi.setCombo(day.dayKey, combo));
    setBusy(null);
    if (ok) {
      toast.success(a('saved'));
      onSaved();
    }
  };
  const saveCipher = async () => {
    setBusy('cipher');
    const ok = await attempt(() => adminApi.setCipher(day.dayKey, cipher));
    setBusy(null);
    if (ok) {
      toast.success(a('saved'));
      onSaved();
    }
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          {day.dayKey}
          {isToday && <Badge tone="good">{a('daily.today')}</Badge>}
        </span>
      }
    >
      {isToday && <p className="mb-3 text-xs font-bold text-gold">{a('daily.todayWarning')}</p>}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
            {a('daily.combo')}
            <Badge>{day.combo.source === 'admin' ? a('daily.admin') : a('daily.auto')}</Badge>
          </p>
          <div className="flex flex-col gap-2">
            {combo.map((id, i) => {
              const card = cards.find((c) => c.id === id);
              return (
                <div key={i} className="flex items-center gap-2">
                  {card && <CardIcon icon={card.icon} size={34} />}
                  <Select
                    value={id}
                    onChange={(e) => setCombo((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                    data-testid={`admin-combo-${day.dayKey}-${i}`}
                  >
                    {active.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.category} · {name(c)}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
          <Button
            className="mt-2 h-9 px-4 text-sm"
            loading={busy === 'combo'}
            onClick={() => void saveCombo()}
          >
            {a('save')}
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex items-center gap-2 text-sm font-extrabold">
            {a('daily.cipher')}
            <Badge>{day.cipher.source === 'admin' ? a('daily.admin') : a('daily.auto')}</Badge>
          </p>
          <div className="flex flex-col gap-2">
            <Field label={a('daily.word')}>
              <TextInput
                value={cipher.word}
                maxLength={7}
                onChange={(e) => setCipher({ ...cipher, word: e.target.value.toUpperCase() })}
                data-testid={`admin-cipher-${day.dayKey}`}
              />
            </Field>
            <Field label={a('daily.hintRu')}>
              <TextInput
                value={cipher.hintRu}
                onChange={(e) => setCipher({ ...cipher, hintRu: e.target.value })}
              />
            </Field>
            <Field label={a('daily.hintEn')}>
              <TextInput
                value={cipher.hintEn}
                onChange={(e) => setCipher({ ...cipher, hintEn: e.target.value })}
              />
            </Field>
          </div>
          <Button
            className="mt-2 h-9 px-4 text-sm"
            loading={busy === 'cipher'}
            onClick={() => void saveCipher()}
          >
            {a('save')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Комбо и шифр на 7 дней вперёд. */
export function DailyTab() {
  const [days, setDays] = useState<AdminDailyDay[] | null>(null);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const load = () =>
    void Promise.all([attempt(() => adminApi.daily()), attempt(() => adminApi.cards())]).then(([d, c]) => {
      if (d) setDays(d.days);
      if (c) setCards(c.cards);
    });
  useEffect(load, []);
  if (!days) return <div className="skeleton h-64 rounded-[20px]" />;
  return (
    <div className="flex flex-col gap-3" data-testid="admin-daily">
      {days.map((d, i) => (
        <DayEditor
          key={`${d.dayKey}:${d.combo.cardIds.join()}:${d.cipher.word}`}
          day={d}
          cards={cards}
          isToday={i === 0}
          onSaved={load}
        />
      ))}
    </div>
  );
}
