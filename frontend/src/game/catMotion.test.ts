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
    expect(m.transforms()).toEqual({ body: '', yaw: 0, pitch: 0 });
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
      expect(Math.abs(m.yaw.x)).toBeLessThanOrEqual(m.yaw.limit);
      expect(Math.abs(m.pitch.x)).toBeLessThanOrEqual(m.pitch.limit);
    }
    expect(settle(m)).toBeLessThan(6);
    expect(m.active).toBe(false);
    expect(m.transforms()).toEqual({ body: '', yaw: 0, pitch: 0 });
  });

  it('a long frame (tab in background) does not explode the springs', () => {
    const m = new CatMotion();
    m.tap(1.35, 1, true);
    m.advance(5);
    expect(Math.abs(m.squash.x)).toBeLessThanOrEqual(m.squash.limit);
    settle(m);
    expect(m.active).toBe(false);
  });
});

describe('hop and wiggle', () => {
  it('a hop never goes below the floor or above the limit and settles exactly', () => {
    const m = new CatMotion();
    for (let i = 0; i < 20; i++) {
      m.hop(1.5);
      m.wiggle(i % 2 ? 20 : -20);
      for (let f = 0; f < 4; f++) {
        m.advance(1 / 60);
        expect(m.lift.x).toBeGreaterThanOrEqual(0);
        expect(m.lift.x).toBeLessThanOrEqual(m.lift.limit);
        expect(Math.abs(m.tilt.x)).toBeLessThanOrEqual(m.tilt.limit);
      }
    }
    for (let f = 0; f < 600 && m.advance(1 / 60); f++);
    expect(m.active).toBe(false);
    expect(m.transforms().body).toBe('');
  });
});

describe('3D orbit', () => {
  it('turns smoothly toward the target without overshooting it much, then back to the front', () => {
    const m = new CatMotion();
    m.orbitTo(5, 1);
    let prev = 0;
    let maxStep = 0;
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      m.advance(1 / 60);
      maxStep = Math.max(maxStep, Math.abs(m.yaw.x - prev));
      prev = m.yaw.x;
      peak = Math.max(peak, m.yaw.x);
    }
    // плавно: за кадр не больше 0,25°, без заметного перелёта
    expect(maxStep).toBeLessThan(0.25);
    expect(peak).toBeLessThan(5.3);
    expect(m.yaw.x).toBeCloseTo(5, 1);
    m.orbitTo(0, 0);
    for (let i = 0; i < 600 && m.advance(1 / 60); i++);
    expect(m.active).toBe(false);
    expect(m.transforms().yaw).toBe(0);
  });

  it('targets are clamped', () => {
    const m = new CatMotion();
    m.orbitTo(40, -20);
    expect(m.yaw.target).toBe(7);
    expect(m.pitch.target).toBe(-3);
  });
});
