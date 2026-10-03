import { haptic } from '../telegram/webapp';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  testId?: string;
}

/**
 * Переключатель из нескольких вариантов. Его нажимают часто — подсветка встаёт на выбранный сразу, без общей
 * анимации раскладки (она пересчитывала положение всего экрана).
 */
export function Segmented<T extends string>({ options, value, onChange, testId }: Props<T>) {
  return (
    <div className="flex rounded-2xl bg-night-900/70 p-1" role="radiogroup" data-testid={testId}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (active) return;
              haptic.select();
              onChange(o.value);
            }}
            // ширина по тексту (свободное место делится поровну): длинные подписи не обрезаются на узком экране
            className={`relative min-w-0 flex-auto rounded-xl px-1.5 py-2 text-[13px] font-extrabold transition-colors ${
              active ? 'text-white' : 'text-white/55'
            }`}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
          >
            {active && <span className="absolute inset-0 rounded-xl bg-night-500 shadow-card" />}
            <span className="relative block truncate whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
