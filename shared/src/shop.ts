import type { PlayerState } from './api.js';

/** Товары магазина за Telegram Stars. Цены и количества — backend/src/game/config/shop.ts. */
export const SHOP_PRODUCT_IDS = [
  'coins_small',
  'coins_medium',
  'coins_large',
  'energy_refill',
  'income_x2',
  'skin_angel_guardian',
  'skin_shadow_drifter',
  'skin_cyber_samurai',
  'skin_galaxy_emperor',
  'skin_forest_spirit',
  'skin_ocean_guardian',
  'skin_inferno',
  'skin_toxic',
  'skin_stealth_assassin',
  'skin_dark_reaper',
  'skin_arctic_king',
  'skin_vampire_lord',
  'skin_lunar_witch',
  'skin_royal_emperor',
  'effect_matrix',
] as const;
export type ShopProductId = (typeof SHOP_PRODUCT_IDS)[number];
export type ShopProductKind = 'coins' | 'energy' | 'income_boost' | 'cosmetic';

/** Во сколько раз растёт пассивный доход, пока действует буст из магазина. */
export const INCOME_BOOST_MULTIPLIER = 2;

export function isShopProductId(id: string): id is ShopProductId {
  return (SHOP_PRODUCT_IDS as readonly string[]).includes(id);
}

export interface ShopProduct {
  id: ShopProductId;
  kind: ShopProductKind;
  /** цена в Telegram Stars */
  stars: number;
  /** сколько монет получит игрок сейчас (пакеты монет) */
  coins: number | null;
  /** на сколько часов действует (буст дохода) */
  hours: number | null;
  /** насколько пакет выгоднее самого маленького, % */
  bonusPercent: number | null;
  popular: boolean;
  /** премиальный предмет коллекции (скин или эффект тапа) */
  cosmeticId: string | null;
  /** предмет коллекции уже куплен */
  owned: boolean;
}

export interface ShopResponse {
  products: ShopProduct[];
}

export interface InvoiceResponse {
  purchaseId: number;
  /** ссылка на счёт для Telegram.WebApp.openInvoice */
  link: string;
}

export type PurchaseStatus = 'pending' | 'paid' | 'refunded';

export interface PurchaseStatusResponse {
  status: PurchaseStatus;
  /** состояние игрока после выдачи покупки */
  state: PlayerState | null;
}
