import type { ProfileResponse } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';

interface ProfileStore {
  data: ProfileResponse | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** загрузить заново (при каждом открытии профиля — статистика меняется постоянно) */
  load(): Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useProfile = create<ProfileStore>((set, get) => ({
  data: null,
  status: 'idle',
  load: () => {
    if (inflight) return inflight;
    if (!get().data) set({ status: 'loading' });
    inflight = endpoints
      .profile()
      .then((data) => set({ data, status: 'ready' }))
      .catch(() => set({ status: get().data ? 'ready' : 'error' }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
}));
