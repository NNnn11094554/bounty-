import { useRef, useState, type ReactNode } from 'react';
import { isReducedMotion } from '../animations';
import { haptic } from '../telegram/webapp';
import { PawIcon } from './icons';

const THRESHOLD = 64;
const MAX_PULL = 110;

interface Props {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/** Прокручиваемый список с pull-to-refresh: тянешь вниз в самом верху — лапка крутится, данные обновляются. */
export function PullToRefresh({ onRefresh, children, className = '', testId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const begin = (y: number) => {
    if (refreshing || (scrollRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = y;
  };
  const move = (y: number) => {
    if (startY.current === null) return;
    const dy = y - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    const next = Math.min(MAX_PULL, dy * 0.5);
    if (next >= THRESHOLD && !armed.current) haptic.select();
    armed.current = next >= THRESHOLD;
    setPull(next);
  };
  const end = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (!armed.current) {
      setPull(0);
      return;
    }
    armed.current = false;
    setRefreshing(true);
    setPull(THRESHOLD);
    try {
      await onRefresh();
      haptic.notify('success');
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const dragging = startY.current !== null;
  return (
    <div
      ref={scrollRef}
      className={`relative overflow-y-auto overscroll-y-contain ${className}`}
      onTouchStart={(e) => begin(e.touches[0]?.clientY ?? 0)}
      onTouchMove={(e) => move(e.touches[0]?.clientY ?? 0)}
      onTouchEnd={() => void end()}
      onTouchCancel={() => void end()}
      onMouseDown={(e) => begin(e.clientY)}
      onMouseMove={(e) => move(e.clientY)}
      onMouseUp={() => void end()}
      onMouseLeave={() => void end()}
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center text-gold"
        style={{
          transform: `translateY(${pull - 34}px)`,
          opacity: Math.min(1, pull / THRESHOLD),
          transition: dragging ? 'none' : 'transform 0.25s, opacity 0.25s',
        }}
        data-testid="pull-indicator"
        data-refreshing={refreshing ? 'true' : undefined}
      >
        <span
          className={refreshing && !isReducedMotion() ? 'animate-spin' : ''}
          style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }}
        >
          <PawIcon size={26} />
        </span>
      </div>
      <div
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.25s',
        }}
      >
        {children}
      </div>
    </div>
  );
}
