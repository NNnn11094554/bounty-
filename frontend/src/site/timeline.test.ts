import { describe, expect, it, vi } from 'vitest';

const onFrame = vi.fn(
  (..._args: unknown[]) =>
    () =>
      undefined,
);
vi.mock('../game/frameLoop', () => ({ onFrame }));

describe('site timeline', () => {
  it('drives the camera every frame, not at the idle rate of the shared game loop', async () => {
    const { startTimeline } = await import('./timeline');
    const stop = startTimeline(document.createElement('main'));
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onFrame.mock.calls[0]![1]).toMatchObject({ hot: true });
    stop();
  });
});
