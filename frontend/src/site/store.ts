import { create } from 'zustand';

/** Состояние сайта, общее для интерфейса и сцены. */
interface SiteState {
  /** загрузка сцены 0…1 */
  progress: number;
  /** сцена готова, идёт вступление */
  ready: boolean;
  /** WebGL недоступен — статичная версия без 3D */
  noWebgl: boolean;
  /** выбранный кот коллекции (индекс в CATS) */
  selected: number;
  setProgress: (progress: number) => void;
  setReady: () => void;
  setNoWebgl: () => void;
  select: (index: number) => void;
}

export const useSite = create<SiteState>((set) => ({
  progress: 0,
  ready: false,
  noWebgl: false,
  selected: 0,
  setProgress: (progress) => set({ progress }),
  setReady: () => set({ ready: true }),
  setNoWebgl: () => set({ noWebgl: true, ready: true }),
  select: (selected) => set({ selected }),
}));

/** Что интерфейс может попросить у сцены (сцена грузится отдельным чанком). */
export interface SceneApi {
  /** тап по экрану в игре: true — попал в кота (сцена сама ответит частицами и реакцией) */
  tap: (clientX: number, clientY: number, turbo: boolean) => boolean;
  /** рамка кота игры на экране (CSS px) — для всплывающих наград и подсказки */
  catRect: () => { x: number; y: number; width: number; height: number } | null;
}

let api: SceneApi | null = null;
export const sceneApi = {
  set: (next: SceneApi | null) => {
    api = next;
  },
  get: () => api,
};
