import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kickFrames, onFrame, wakeFrames } from './frameLoop';

describe('shared frame loop', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('at rest updates ~10 times a second, after a touch — every frame for a while', () => {
    const cb = vi.fn();
    const off = onFrame(cb);
    try {
      vi.advanceTimersByTime(1000);
      // в покое: ~10 обновлений в секунду, а не 60
      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(8);
      expect(cb.mock.calls.length).toBeLessThanOrEqual(12);
      cb.mockClear();
      kickFrames();
      vi.advanceTimersByTime(500);
      // после касания — каждый кадр (~16 мс)
      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(25);
      // через ~1,2 с без касаний — снова покой
      vi.advanceTimersByTime(1500);
      cb.mockClear();
      vi.advanceTimersByTime(1000);
      expect(cb.mock.calls.length).toBeLessThanOrEqual(12);
    } finally {
      off();
    }
  });

  it('runs only while a subscriber is on a visible screen, and starts again when it is shown', () => {
    let visible = true;
    const cb = vi.fn();
    const off = onFrame(cb, { active: () => visible });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalled();
    visible = false;
    vi.advanceTimersByTime(300);
    cb.mockClear();
    vi.advanceTimersByTime(2000);
    // скрытый подписчик не вызывается и цикл не держит
    expect(cb).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    visible = true;
    wakeFrames();
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalled();
    off();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a subscriber that needs smoothness keeps every frame', () => {
    const cb = vi.fn();
    const off = onFrame(cb, { hot: true });
    try {
      vi.advanceTimersByTime(3000);
      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(150);
    } finally {
      off();
    }
  });
});
