import { HEADQUARTERS, hqColors, hqIcon } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useLocale } from '../i18n';
import { haptic } from '../telegram/webapp';
import { CardIcon } from './cards/CardIcon';

/** Сетка из шести штаб-квартир с выбором. */
export function HqPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" data-testid="hq-picker">
      {HEADQUARTERS.map((hq, i) => {
        const selected = hq.id === value;
        const [light, dark] = hqColors(hq);
        return (
          <motion.button
            key={hq.id}
            type="button"
            role="radio"
            aria-checked={selected}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, scale: selected ? 1.03 : 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 26 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              haptic.select();
              onChange(hq.id);
            }}
            className={`relative flex flex-col items-center gap-2 overflow-hidden rounded-[20px] border-2 p-3 text-center ${
              selected ? 'border-gold shadow-glow' : 'border-line'
            }`}
            style={{ background: `linear-gradient(160deg, ${light}33, ${dark}22), #2a2140` }}
            data-testid={`hq-${hq.id}`}
          >
            <CardIcon icon={hqIcon(hq)} size={56} />
            <span className="text-sm font-extrabold leading-tight">{hq.name[locale]}</span>
            {selected && (
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-xs font-black text-night-900">
                ✓
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
