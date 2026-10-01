import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom не умеет ResizeObserver и Web Animations — минимальные реализации для тестов
class ResizeObserverMock {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element): void {
    this.cb(
      [{ target, contentRect: { width: 375, height: 400 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
if (!Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    return { cancel() {}, finish() {}, onfinish: null } as unknown as Animation;
  };
}
