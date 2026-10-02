import { describe, expect, it } from 'vitest';
import { CatMotion } from './catMotion';

/** Прогнать физику кадрами по 1/60 с, пока не успокоится (не дольше limit секунд). */
function settle(m: CatMotion, limit = 6): number {
  let t = 0;
  while (m.advance(1 / 60) && t < limit) t += 1 / 60;
  return t;
}

describe('cat tap physics', () => {
  it('one tap: a soft squash (≈0.98) and a small rebound, then exactly back to rest', () => {
    const m = new CatMotion();
    m.tap(1, 0.3, false);
    let min = 0;
    let max = 0;
    for (let i = 0; i < 90; i++) {
      m.advance(1 / 60);
      min = Math.min(min, m.squash.x);
      max = Math.max(max, m.squash.x);
    }
    expect(min).toBeLessThan(-0.012);
    expect(min).toBeGreaterThan(-0.03);
    expect(max).toBeLessThan(0.015);
    settle(m);
    expect(m.transforms()).toEqual({ body: '', head: '', tail: '', ear: '', foot: '' });
  });

  it('50 rapid taps never exceed the limits and the cat returns to the initial pose', () => {
    const m = new CatMotion();
    for (let i = 0; i < 50; i++) {
      m.tap(1.35, i % 2 ? 0.8 : -0.8, i % 3 === 0);
      // 50 тапов за ~1,5 с: 2 кадра между тапами
      m.advance(1 / 60);
      m.advance(1 / 60);
      expect(Math.abs(m.squash.x)).toBeLessThanOrEqual(m.squash.limit);
      expect(Math.abs(m.tilt.x)).toBeLessThanOrEqual(m.tilt.limit);
      expect(Math.abs(m.head.x)).toBeLessThanOrEqual(m.head.limit);
      expect(Math.abs(m.tail.x)).toBeLessThanOrEqual(m.tail.limit);
      expect(Math.abs(m.ear.x)).toBeLessThanOrEqual(m.ear.limit);
    }
    expect(settle(m)).toBeLessThan(6);
    expect(m.active).toBe(false);
    expect(m.transforms()).toEqual({ body: '', head: '', tail: '', ear: '', foot: '' });
  });

  it('a long frame (tab in background) does not explode the springs', () => {
    const m = new CatMotion();
    m.tap(1.35, 1, true);
    m.advance(5);
    expect(Math.abs(m.squash.x)).toBeLessThanOrEqual(m.squash.limit);
    settle(m);
    expect(m.active).toBe(false);
  });

  it('the head can hold a gaze target and comes back when released', () => {
    const m = new CatMotion();
    m.lookAt(9, 9);
    settle(m);
    expect(m.head.x).toBe(3);
    expect(m.look.x).toBe(1.4);
    expect(m.transforms().head).toContain('rotate(3.000deg)');
    m.lookAt(0, 0);
    settle(m);
    expect(m.transforms().head).toBe('');
  });
});

describe('ear and foot', () => {
  it('the heel never goes below the floor, ear and foot settle exactly', () => {
    const m = new CatMotion();
    for (let i = 0; i < 20; i++) {
      m.stomp(1);
      m.twitch(i % 2 ? 1 : -1, 1.2);
      for (let f = 0; f < 4; f++) {
        m.advance(1 / 60);
        expect(m.foot.x).toBeGreaterThanOrEqual(0);
        expect(m.foot.x).toBeLessThanOrEqual(m.foot.limit);
        expect(Math.abs(m.ear.x)).toBeLessThanOrEqual(m.ear.limit);
      }
    }
    for (let f = 0; f < 600 && m.advance(1 / 60); f++);
    expect(m.active).toBe(false);
    const t = m.transforms();
    expect(t.ear).toBe('');
    expect(t.foot).toBe('');
  });
});
