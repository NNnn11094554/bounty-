import { cosmeticById, type CollectionActionResponse, type ShopProductId } from '@meowgul/shared';
import { create } from './create';
import { ApiError } from '../api/client';
import { endpoints } from '../api/endpoints';
import { catMood } from '../game/catMood';
import { preloadSkin } from '../game/skins';
import { tapEngine } from '../game/tapEngine';
import { useShop, type BuyResult } from './shop';

/** Премиальный предмет коллекции → товар магазина за Stars. */
export function starsProductOf(id: string): ShopProductId | null {
  const item = cosmeticById(id);
  if (item?.price?.currency !== 'stars') return null;
  return (item.kind === 'skin' ? `skin_${id}` : `effect_${id}`) as ShopProductId;
}

export type CollectionError = 'locked' | 'funds' | 'owned' | 'failed';

interface CollectionStore {
  owned: string[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** id предмета, с которым идёт действие */
  busy: string | null;
  load(): Promise<void>;
  /** покупка: за монеты — сразу на сервере, за Stars — через счёт Telegram */
  buy(id: string): Promise<'ok' | CollectionError | BuyResult>;
  equip(id: string): Promise<'ok' | CollectionError>;
}

function applyAction(res: CollectionActionResponse, set: (p: Partial<CollectionStore>) => void) {
  tapEngine.applyServerState(res.state);
  set({ owned: res.owned, status: 'ready' });
}

function errorOf(err: unknown): CollectionError {
  if (err instanceof ApiError) {
    if (err.code === 'LOCKED') return 'locked';
    if (err.code === 'INSUFFICIENT_FUNDS') return 'funds';
    if (err.code === 'CONFLICT') return 'owned';
  }
  return 'failed';
}

/** Коллекция игрока: источник истины — сервер (владение, уровень, цена и надетый скин хранятся там). */
export const useCollection = create<CollectionStore>((set, get) => ({
  owned: [],
  status: 'idle',
  busy: null,
  load: async () => {
    if (get().status !== 'ready') set({ status: 'loading' });
    try {
      const res = await endpoints.collection();
      set({ owned: res.owned, status: 'ready' });
    } catch {
      set({ status: get().owned.length ? 'ready' : 'error' });
    }
  },
  buy: async (id) => {
    if (get().busy) return 'failed';
    const product = starsProductOf(id);
    set({ busy: id });
    try {
      if (product) {
        const result = await useShop.getState().buy(product);
        if (result === 'paid') {
          await get().load();
          catMood.emit('purchase');
          return 'ok';
        }
        return result;
      }
      await tapEngine.flush();
      // купленное сразу надевается: картинки нового персонажа грузятся параллельно с запросом
      const pre = cosmeticById(id)?.kind === 'skin' ? preloadSkin(id) : null;
      const res = await endpoints.buyCosmetic(id);
      await pre;
      applyAction(res, set);
      catMood.emit('purchase');
      return 'ok';
    } catch (err) {
      return errorOf(err);
    } finally {
      set({ busy: null });
    }
  },
  equip: async (id) => {
    if (get().busy) return 'failed';
    set({ busy: id });
    try {
      // персонаж и его мир грузятся параллельно с запросом: смена проходит без «мигания»
      const pre = cosmeticById(id)?.kind === 'skin' ? preloadSkin(id) : null;
      const res = await endpoints.equipCosmetic(id);
      await pre;
      applyAction(res, set);
      catMood.emit('equip');
      return 'ok';
    } catch (err) {
      return errorOf(err);
    } finally {
      set({ busy: null });
    }
  },
}));
