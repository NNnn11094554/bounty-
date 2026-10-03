import { describe, expect, it } from 'vitest';
import { CatMotion } from './catMotion';

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

  it('a long frame (tab in background) does not explode the springs', () => {
    const m = new CatMotion();
    m.orbitTo(7, 3);
    m.advance(5);
    expect(Math.abs(m.yaw.x)).toBeLessThanOrEqual(m.yaw.limit);
    for (let i = 0; i < 600 && m.advance(1 / 60); i++);
    expect(m.active).toBe(false);
    expect(m.transforms()).toEqual({ yaw: 7, pitch: 3 });
  });

  it('targets are clamped', () => {
    const m = new CatMotion();
    m.orbitTo(40, -20);
    expect(m.yaw.target).toBe(7);
    expect(m.pitch.target).toBe(-3);
  });
});
