import { useCallback, useRef, useState } from 'react';

/**
 * Действие с запросом к серверу (купить, забрать, активировать): пока оно идёт, повторные нажатия
 * игнорируются — даже несколько тапов в одном кадре, до перерисовки (флаг в ref, а не только в state).
 * busy — для кнопки (крутилка, disabled).
 */
export function useBusy(): [boolean, <T>(action: () => Promise<T>) => Promise<T | undefined>] {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await action();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
