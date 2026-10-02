import { useEffect, useState } from 'react';

/** сколько элементов рисуется сразу — с запасом на первый экран */
const FIRST = 10;
/** сколько добавляется за кадр */
const STEP = 8;

/**
 * Длинный список рисуется частями: первый экран — сразу, остальное — по кадрам. Так переход на вкладку
 * не ждёт, пока построятся десятки карточек ниже экрана. При смене key (другая категория) — заново.
 */
export function useProgressiveCount(total: number, key: string): number {
  const [state, setState] = useState({ key, count: FIRST });
  const count = state.key === key ? state.count : FIRST;
  useEffect(() => {
    if (count >= total) return;
    const id = requestAnimationFrame(() => setState({ key, count: count + STEP }));
    return () => cancelAnimationFrame(id);
  }, [count, total, key]);
  return Math.min(count, total);
}
