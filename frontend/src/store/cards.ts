import type { CardCategory, CardView } from '@meowgul/shared';
import { create } from 'zustand';
import { endpoints } from '../api/endpoints';
import { useGame } from './game';

export type SpecialsTab = 'mine' | 'new' | 'upgraded';
type Status = 'idle' | 'loading' | 'ready' | 'error';

/** Через сколько список карточек считается устаревшим и перезапрашивается при открытии Mine. */
const FRESH_MS = 60_000;

interface CardsStore {
  cards: CardView[];
  status: Status;
  loadedAt: number;
  /** лига игрока на момент загрузки: новая лига может открыть карточки */
  loadedLeague: number;
  category: CardCategory;
  specialsTab: SpecialsTab | null;
  /** последняя улучшенная карточка — для анимации плитки */
  lastUpgrade: { id: string; at: number } | null;
  load(force?: boolean): Promise<void>;
  merge(cards: CardView[]): void;
  markUpgraded(id: string): void;
  setCategory(category: CardCategory): void;
  setSpecialsTab(tab: SpecialsTab): void;
  reset(): void;
}

let inflight: Promise<void> | null = null;

export const useCards = create<CardsStore>((set, get) => ({
  cards: [],
  status: 'idle',
  loadedAt: 0,
  loadedLeague: -1,
  category: 'LAYER1',
  specialsTab: null,
  lastUpgrade: null,
  load: (force = false) => {
    const { status, loadedAt, loadedLeague } = get();
    const league = useGame.getState().player?.leagueLevel ?? 0;
    const fresh = Date.now() - loadedAt < FRESH_MS && loadedLeague === league;
    if (!force && status === 'ready' && fresh) return Promise.resolve();
    if (inflight) return inflight;
    set({ status: get().cards.length ? get().status : 'loading' });
    inflight = endpoints
      .cards()
      .then((res) =>
        set({
          cards: res.cards,
          status: 'ready',
          loadedAt: Date.now(),
          loadedLeague: league,
        }),
      )
      .catch(() => {
        // при ошибке оставляем то, что уже показано; пустой экран — с кнопкой «Повторить»
        set({ status: get().cards.length ? 'ready' : 'error' });
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },
  merge: (updated) => {
    const byId = new Map(updated.map((c) => [c.id, c]));
    const cards = get().cards.map((c) => byId.get(c.id) ?? c);
    for (const c of updated) if (!cards.some((x) => x.id === c.id)) cards.push(c);
    set({ cards });
  },
  markUpgraded: (id) => set({ lastUpgrade: { id, at: Date.now() } }),
  setCategory: (category) => set({ category }),
  setSpecialsTab: (specialsTab) => set({ specialsTab }),
  reset: () => set({ cards: [], status: 'idle', loadedAt: 0, lastUpgrade: null }),
}));
