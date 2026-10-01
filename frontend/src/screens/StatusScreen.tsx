import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { CharacterImage } from '../components/CharacterImage';

interface Props {
  title: string;
  text: string;
  /** кот «спит» (тусклый, Zzz) — для техработ и ошибок */
  sleepy?: boolean;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
  testId?: string;
}

/** Экран-заглушка состояния: нет сети, техработы, бан, устаревшая версия, ошибка. */
export function StatusScreen({ title, text, sleepy = true, action, children, testId }: Props) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center"
      data-testid={testId}
    >
      <div className="relative">
        <div
          className="h-36 w-36 overflow-hidden rounded-full ring-4 ring-white/10"
          style={sleepy ? { filter: 'brightness(0.6) grayscale(0.5)' } : undefined}
        >
          <CharacterImage size={144} className="h-full w-full" />
        </div>
        {sleepy && (
          <motion.span
            className="absolute -right-3 -top-4 text-2xl font-black text-white/70"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            Zzz
          </motion.span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="text-[15px] leading-snug text-white/60">{text}</p>
      </div>
      {children}
      {action && (
        <Button onClick={action.onClick} className="min-w-[200px]">
          {action.label}
        </Button>
      )}
    </div>
  );
}
