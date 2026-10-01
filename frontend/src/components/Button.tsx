import { motion, type HTMLMotionProps } from 'framer-motion';
import { haptic } from '../telegram/webapp';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props extends HTMLMotionProps<'button'> {
  variant?: Variant;
  block?: boolean;
  loading?: boolean;
}

const STYLES: Record<Variant, string> = {
  primary: 'bg-cta text-white shadow-button',
  secondary: 'bg-night-600 text-white shadow-card border border-line',
  ghost: 'bg-transparent text-white/80',
};

/** Кнопка с пружинящим нажатием и тактильным откликом. */
export function Button({
  variant = 'primary',
  block,
  loading,
  disabled,
  className = '',
  children,
  onClick,
  ...rest
}: Props) {
  const inactive = disabled || loading;
  return (
    <motion.button
      type="button"
      whileTap={inactive ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
      disabled={inactive}
      onClick={(e) => {
        if (inactive) return;
        haptic.impact('light');
        onClick?.(e);
      }}
      className={`relative inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold transition-opacity ${
        STYLES[variant]
      } ${block ? 'w-full' : ''} ${inactive ? 'opacity-50' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        children
      )}
    </motion.button>
  );
}
