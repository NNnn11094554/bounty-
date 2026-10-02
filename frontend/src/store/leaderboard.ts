import type { LeaderboardResponse } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';

/** Сервер обновляет рейтинг раз в минуту — чаще запрашивать незачем. */
const FRESH_MS = 60_000;

interface Entry {
  data: LeaderboardResponse | null;
  status: 'loading' | 'ready' | 'error';
  loadedAt: number;
}

interface LeaderboardStore {
  leagues: Record<number, Entry>;
  load(level: number, force?: boolean): Promise<void>;
}

const inflight = new Map<number, Promise<void>>();

export const useLeaderboard = create<LeaderboardStore>((set, get) => ({
  leagues: {},
  load: (level, force = false) => {
    const entry = get().leagues[level];
    if (!force && entry?.status === 'ready' && Date.now() - entry.loadedAt < FRESH_MS)
      return Promise.resolve();
    const running = inflight.get(level);
    if (running) return running;
    const update = (patch: Partial<Entry>) =>
      set((s) => ({
        leagues: {
          ...s.leagues,
          [level]: { data: null, status: 'loading', loadedAt: 0, ...s.leagues[level], ...patch },
        },
      }));
    if (!entry?.data) update({ status: 'loading' });
    const promise = endpoints
      .leagueTop(level)
      .then((data) => update({ data, status: 'ready', loadedAt: Date.now() }))
      .catch(() => update({ status: get().leagues[level]?.data ? 'ready' : 'error' }))
      .finally(() => inflight.delete(level));
    inflight.set(level, promise);
    return promise;
  },
}));
