import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Карточка-раздел админки. */
export function Panel({
  title,
  actions,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-line bg-night-700 p-4 shadow-card">
      {(title || actions) && (
        <div className="mb-3 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-bold text-white/55">{label}</span>
      {children}
      {hint && <span className="text-[11px] font-semibold leading-snug text-white/40">{hint}</span>}
    </label>
  );
}

const INPUT =
  'w-full min-w-0 rounded-xl border border-white/10 bg-night-900/70 px-3 py-2 text-sm font-semibold text-white outline-none transition-colors placeholder:text-white/30 focus:border-gold/60';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

export function NumberInput({
  value,
  onChange,
  step,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? 'any'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      {...rest}
      className={`${INPUT} tabular ${rest.className ?? ''}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${INPUT} resize-y ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
  children: ReactNode;
}) {
  const tones = {
    neutral: 'bg-white/10 text-white/70',
    good: 'bg-lime/15 text-lime',
    bad: 'bg-[#ff5f6d]/15 text-[#ff8a95]',
    warn: 'bg-gold/15 text-gold',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-night-800 px-3 py-2.5" title={hint}>
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-0.5 truncate text-xl font-black tabular">{value}</p>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm font-bold text-white/45">{children}</p>;
}
