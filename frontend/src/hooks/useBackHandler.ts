import { useEffect, useRef } from 'react';
import { pushBackHandler } from '../store/nav';

/** Пока active — кнопка «Назад» Telegram (и Esc) вызывает onBack. */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    return pushBackHandler(() => ref.current());
  }, [active]);
}
