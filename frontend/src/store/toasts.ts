import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'reward' | 'network';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
  /** мс; 0 — пока не уберут вручную */
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  show(toast: Omit<Toast, 'id' | 'duration'> & { id?: string; duration?: number }): string;
  dismiss(id: string): void;
}

let counter = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: ({ id, kind, text, duration = 2600 }) => {
    const toastId = id ?? `t${++counter}`;
    const rest = get().toasts.filter((t) => t.id !== toastId);
    set({ toasts: [...rest.slice(-2), { id: toastId, kind, text, duration }] });
    const old = timers.get(toastId);
    if (old) clearTimeout(old);
    if (duration > 0)
      timers.set(
        toastId,
        setTimeout(() => get().dismiss(toastId), duration),
      );
    return toastId;
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (text: string) => useToasts.getState().show({ kind: 'info', text }),
  success: (text: string) => useToasts.getState().show({ kind: 'success', text }),
  error: (text: string) => useToasts.getState().show({ kind: 'error', text, duration: 3200 }),
  reward: (text: string) => useToasts.getState().show({ kind: 'reward', text }),
};
