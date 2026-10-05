/**
 * Запись inline-стиля, только если значение изменилось. Покадровые подписчики (линия прогресса, подсказка
 * «тапни», шкала энергии) иначе пишут то же значение каждый кадр — и каждый раз браузер пересчитывает стили.
 */
const written = new WeakMap<HTMLElement, Map<string, string>>();

export function setStyle(el: HTMLElement, prop: 'transform' | 'opacity' | 'visibility', value: string): void {
  let props = written.get(el);
  if (!props) written.set(el, (props = new Map()));
  if (props.get(prop) === value) return;
  props.set(prop, value);
  el.style[prop] = value;
}
