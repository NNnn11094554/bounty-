import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createLayer, LayerContext, setLayerVisible } from '../hooks/tabLayer';
import { create } from './create';

describe('stores and hidden tabs', () => {
  it('a hidden tab does not re-render from store changes; showing it updates the screen at once', () => {
    const useCounter = create<{ n: number }>(() => ({ n: 0 }));
    const layer = createLayer('shop');
    let renders = 0;
    function Count() {
      renders++;
      return <span data-testid="n">{useCounter((s) => s.n)}</span>;
    }
    const { getByTestId } = render(
      <LayerContext.Provider value={layer}>
        <Count />
      </LayerContext.Provider>,
    );
    act(() => setLayerVisible(layer, true));
    act(() => useCounter.setState({ n: 1 }));
    expect(getByTestId('n').textContent).toBe('1');
    const shown = renders;

    act(() => setLayerVisible(layer, false));
    act(() => useCounter.setState({ n: 2 }));
    act(() => useCounter.setState({ n: 3 }));
    // скрыта: ни одной перерисовки, на экране — то, что было
    expect(renders).toBe(shown);
    expect(getByTestId('n').textContent).toBe('1');

    act(() => setLayerVisible(layer, true));
    // показана: одна перерисовка с последним значением
    expect(getByTestId('n').textContent).toBe('3');
    expect(renders).toBe(shown + 1);
  });

  it('a hidden tab whose data did not change is not re-rendered when shown', () => {
    const useStore = create<{ a: number; b: number }>(() => ({ a: 0, b: 0 }));
    const layer = createLayer('profile');
    let renders = 0;
    function A() {
      renders++;
      return <span>{useStore((s) => s.a)}</span>;
    }
    render(
      <LayerContext.Provider value={layer}>
        <A />
      </LayerContext.Provider>,
    );
    act(() => setLayerVisible(layer, true));
    const before = renders;
    act(() => setLayerVisible(layer, false));
    act(() => useStore.setState({ b: 5 }));
    act(() => setLayerVisible(layer, true));
    expect(renders).toBe(before);
  });

  it('outside tabs (sheets, the shell) the store works as usual', () => {
    const useCounter = create<{ n: number }>(() => ({ n: 0 }));
    function Count() {
      return <span data-testid="n">{useCounter((s) => s.n)}</span>;
    }
    const { getByTestId } = render(<Count />);
    act(() => useCounter.setState({ n: 7 }));
    expect(getByTestId('n').textContent).toBe('7');
    expect(useCounter.getState().n).toBe(7);
  });
});
