import { useEffect } from 'react';
import { create } from 'zustand';

/** Сколько сейчас открыто модалок и полноэкранных сцен. */
export const useOverlays = create<{ blocking: number }>(() => ({ blocking: 0 }));

/**
 * Модалка или сцена открыта — всплывающие уведомления (достижения, подсказки вкладок)
 * ждут её закрытия, чтобы не перекрывать кнопки.
 */
export function useBlockingOverlay(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    useOverlays.setState((s) => ({ blocking: s.blocking + 1 }));
    return () => useOverlays.setState((s) => ({ blocking: Math.max(0, s.blocking - 1) }));
  }, [active]);
}
