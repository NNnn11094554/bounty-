import type { TaskView } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';

const FRESH_MS = 60_000;

interface TasksStore {
  tasks: TaskView[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadedAt: number;
  load(force?: boolean): Promise<void>;
  upsert(task: TaskView): void;
}

let inflight: Promise<void> | null = null;

export const useTasks = create<TasksStore>((set, get) => ({
  tasks: [],
  status: 'idle',
  loadedAt: 0,
  load: (force = false) => {
    const { status, loadedAt } = get();
    if (!force && status === 'ready' && Date.now() - loadedAt < FRESH_MS) return Promise.resolve();
    if (inflight) return inflight;
    if (status !== 'ready') set({ status: 'loading' });
    inflight = endpoints
      .tasks()
      .then((res) => set({ tasks: res.tasks, status: 'ready', loadedAt: Date.now() }))
      .catch(() => set({ status: get().tasks.length ? 'ready' : 'error' }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  upsert: (task) => set({ tasks: get().tasks.map((t) => (t.id === task.id ? task : t)) }),
}));
