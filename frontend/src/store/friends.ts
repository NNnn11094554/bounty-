import type { FriendEntry, FriendsResponse } from '@meowgul/shared';
import { create } from './create';
import { endpoints } from '../api/endpoints';

const FRESH_MS = 60_000;

interface FriendsStore {
  data: Omit<FriendsResponse, 'friends' | 'nextCursor'> | null;
  friends: FriendEntry[];
  nextCursor: number | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadingMore: boolean;
  loadedAt: number;
  load(force?: boolean): Promise<void>;
  loadMore(): Promise<void>;
}

let inflight: Promise<void> | null = null;

export const useFriends = create<FriendsStore>((set, get) => ({
  data: null,
  friends: [],
  nextCursor: null,
  status: 'idle',
  loadingMore: false,
  loadedAt: 0,
  load: (force = false) => {
    const { status, loadedAt } = get();
    if (!force && status === 'ready' && Date.now() - loadedAt < FRESH_MS) return Promise.resolve();
    if (inflight) return inflight;
    if (status !== 'ready') set({ status: 'loading' });
    inflight = endpoints
      .friends()
      .then(({ friends, nextCursor, ...data }) =>
        set({ data, friends, nextCursor, status: 'ready', loadedAt: Date.now() }),
      )
      .catch(() => set({ status: get().data ? 'ready' : 'error' }))
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  loadMore: async () => {
    const { nextCursor, loadingMore } = get();
    if (nextCursor === null || loadingMore) return;
    set({ loadingMore: true });
    try {
      const res = await endpoints.friends(nextCursor);
      const known = new Set(get().friends.map((f) => f.id));
      set({
        friends: [...get().friends, ...res.friends.filter((f) => !known.has(f.id))],
        nextCursor: res.nextCursor,
      });
    } finally {
      set({ loadingMore: false });
    }
  },
}));
