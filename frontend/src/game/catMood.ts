/**
 * События игры, на которые кот реагирует эмоцией: покупка, новый скин, уровень, редкая награда,
 * новый друг, возвращение в игру. Кот подписывается сам; React не перерисовывается.
 */
export type CatEvent = 'purchase' | 'equip' | 'levelUp' | 'rare' | 'friend' | 'return';

type Listener = (event: CatEvent) => void;
const listeners = new Set<Listener>();

export const catMood = {
  emit(event: CatEvent): void {
    listeners.forEach((l) => l(event));
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
