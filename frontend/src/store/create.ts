import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import { createStore, type StateCreator, type StoreApi } from 'zustand/vanilla';
import { LayerContext } from '../hooks/tabLayer';

export type UseBoundStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
} & StoreApi<T>;

const identity = <T>(state: T): T => state;

/**
 * create из zustand с одним отличием: компоненты скрытой вкладки (components/TabLayer) не перерисовываются от
 * изменений стора — видят то, что было, когда вкладку скрыли, и при показе обновляются разом, причём только
 * те, у кого что-то изменилось. Скрытая вкладка не тратит время телефона, пока игрок на другой. Вне вкладок
 * (экраны поверх, окна, оболочка) — обычный стор.
 */
export function create<T>(init: StateCreator<T, [], []>): UseBoundStore<T> {
  const api = createStore<T>()(init);
  function useBound<U>(selector: (state: T) => U = identity as (state: T) => U): U {
    const layer = useContext(LayerContext);
    /** значение, которое компонент видел, пока вкладка была на экране */
    const seen = useRef<{ value: U } | null>(null);
    const subscribe = useCallback(
      (onChange: () => void) => {
        const offStore = api.subscribe(onChange);
        const offLayer = layer?.onVisibility(onChange);
        return () => {
          offStore();
          offLayer?.();
        };
      },
      [layer],
    );
    const snapshot = () => {
      const value = selector(api.getState());
      if (!layer || layer.visible || !seen.current) {
        seen.current = { value };
        return value;
      }
      return seen.current.value;
    };
    return useSyncExternalStore(subscribe, snapshot, snapshot);
  }
  return Object.assign(useBound, api) as UseBoundStore<T>;
}
