import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { wakeFrames } from '../game/frameLoop';
import type { Tab } from '../store/nav';

/**
 * Вкладки не строятся заново при каждом переключении (components/TabLayer): открытая однажды вкладка остаётся
 * в памяти, скрытая — заморожена (сторы её не перерисовывают — store/create, браузер её не считает и не
 * рисует — content-visibility). Здесь — то, что нужно экранам внутри вкладки: обновить данные при каждом
 * показе (useOnTabShow), сделать при уходе то, что раньше делалось при размонтировании (useOnTabHide), не
 * гонять таймеры и покадровые циклы, пока вкладка скрыта (useLayerShown, useLayerVisible).
 */

export interface Layer {
  tab: Tab;
  /** вкладка на экране — меняется до отрисовки кадра (сторы и таймеры сверяются с этим) */
  visible: boolean;
  /** показ уже отработан эффектами экрана (useOnTabShow / useOnTabHide) — после отрисовки кадра */
  effectsVisible: boolean;
  showListeners: Set<() => void>;
  hideListeners: Set<() => void>;
  /** подписка на показ и скрытие (сторы, useLayerShown) */
  onVisibility(listener: () => void): () => void;
  notifyVisibility(): void;
}

export function createLayer(tab: Tab): Layer {
  const visibility = new Set<() => void>();
  return {
    tab,
    visible: false,
    effectsVisible: false,
    showListeners: new Set(),
    hideListeners: new Set(),
    onVisibility(listener) {
      visibility.add(listener);
      return () => {
        visibility.delete(listener);
      };
    },
    notifyVisibility() {
      visibility.forEach((listener) => listener());
    },
  };
}

export const LayerContext = createContext<Layer | null>(null);

/**
 * Вкладку показали или скрыли (components/TabLayer, до отрисовки кадра): компоненты, у которых за время
 * скрытия что-то изменилось, перерисовываются сразу, покадровые числа снова идут.
 */
export function setLayerVisible(layer: Layer, visible: boolean): void {
  if (layer.visible === visible) return;
  layer.visible = visible;
  // покадровые числа показанной вкладки снова идут (скрытые вкладки цикл не держат)
  if (visible) wakeFrames();
  layer.notifyVisibility();
}

/**
 * Видна ли вкладка компонента — для покадровых циклов (без перерисовки React). Вне вкладок (экраны поверх,
 * окна) — всегда да.
 */
export function useLayerVisible(): () => boolean {
  const layer = useContext(LayerContext);
  return useMemo(() => () => layer === null || layer.visible, [layer]);
}

const noop = () => undefined;

/** Видна ли вкладка компонента; компонент перерисовывается при показе и скрытии. Вне вкладок — да. */
export function useLayerShown(): boolean {
  const layer = useContext(LayerContext);
  const subscribe = useCallback((listener: () => void) => layer?.onVisibility(listener) ?? noop, [layer]);
  const shown = () => layer === null || layer.visible;
  return useSyncExternalStore(subscribe, shown, shown);
}

/**
 * Вызвать при каждом показе вкладки (обновить данные экрана). Вне вкладок — один раз при появлении.
 * Вкладка, построенная заранее и ещё не открытая, ничего не загружает.
 */
export function useOnTabShow(callback: () => void): void {
  const layer = useContext(LayerContext);
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const run = () => ref.current();
    if (!layer) {
      run();
      return;
    }
    layer.showListeners.add(run);
    // компонент появился во вкладке, которая уже на экране
    if (layer.effectsVisible) run();
    return () => {
      layer.showListeners.delete(run);
    };
  }, [layer]);
}

/**
 * Вызвать, когда вкладку скрывают (уходя с экрана — то, что раньше делалось при размонтировании).
 * Вне вкладок — при размонтировании.
 */
export function useOnTabHide(callback: () => void): void {
  const layer = useContext(LayerContext);
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const run = () => ref.current();
    if (!layer) return run;
    layer.hideListeners.add(run);
    return () => {
      layer.hideListeners.delete(run);
      run();
    };
  }, [layer]);
}
