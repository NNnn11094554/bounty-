import { motion } from 'framer-motion';
import { useId } from 'react';
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

/** Переключатель из нескольких вариантов; подсветка выбранного переезжает между ними. */
export function Segmented<T extends string>({ options, value, onChange, testId }: Props<T>) {
  const layoutId = `seg-${useId()}`;
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
            className={`relative min-w-0 flex-1 rounded-xl px-2 py-2 text-[13px] font-extrabold transition-colors ${
              active ? 'text-white' : 'text-white/55'
            }`}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-night-500 shadow-card"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative block truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
