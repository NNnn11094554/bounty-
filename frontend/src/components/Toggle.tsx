import { motion } from 'framer-motion';
import { haptic } from '../telegram/webapp';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  testId?: string;
}

/** Переключатель в стиле iOS: ползунок едет пружиной, фон перетекает в фирменный градиент. */
export function Toggle({ checked, onChange, label, disabled, testId }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic.select();
        onChange(!checked);
      }}
      className={`relative h-[30px] w-[52px] shrink-0 rounded-full p-[3px] transition-[background,opacity] duration-200 ${
        checked ? 'bg-cta shadow-button' : 'bg-white/15'
      } ${disabled ? 'opacity-50' : ''}`}
      data-testid={testId}
    >
      <motion.span
        className="block h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        initial={false}
        animate={{ x: checked ? 22 : 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 34 }}
      />
    </button>
  );
}
