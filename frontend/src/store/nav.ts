import { create } from 'zustand';
import { getWebApp } from '../telegram/webapp';

export type Tab = 'office' | 'mine' | 'friends' | 'earn' | 'airdrop';
export type SubScreen = 'boosts' | 'leagues' | 'settings' | 'profile';

interface NavStore {
  tab: Tab;
  /** стек экранов поверх вкладки */
  stack: SubScreen[];
  setTab(tab: Tab): void;
  push(screen: SubScreen): void;
  pop(): void;
  reset(): void;
}

export const useNav = create<NavStore>((set, get) => ({
  tab: 'office',
  stack: [],
  setTab: (tab) => set({ tab, stack: [] }),
  push: (screen) => set({ stack: [...get().stack.filter((s) => s !== screen), screen] }),
  pop: () => set({ stack: get().stack.slice(0, -1) }),
  reset: () => set({ stack: [] }),
}));

/**
 * Обработчики «Назад» (кнопка Telegram BackButton): верхний в стеке срабатывает первым —
 * сначала закрывается модалка, потом экран.
 */
const backHandlers: Array<() => void> = [];

function syncBackButton(): void {
  const app = getWebApp();
  if (!app) return;
  try {
    if (backHandlers.length) app.BackButton.show();
    else app.BackButton.hide();
  } catch {
    /* старые клиенты без BackButton */
  }
}

let wired = false;
function wire(): void {
  if (wired) return;
  wired = true;
  getWebApp()?.BackButton.onClick(() => backHandlers[backHandlers.length - 1]?.());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') backHandlers[backHandlers.length - 1]?.();
  });
}

export function pushBackHandler(handler: () => void): () => void {
  wire();
  backHandlers.push(handler);
  syncBackButton();
  return () => {
    const i = backHandlers.lastIndexOf(handler);
    if (i >= 0) backHandlers.splice(i, 1);
    syncBackButton();
  };
}
