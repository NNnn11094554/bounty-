import type { PlayerState } from './api.js';

/** Товары магазина за Telegram Stars. Цены и количества — backend/src/game/config/shop.ts. */
export const SHOP_PRODUCT_IDS = [
  'coins_small',
  'coins_medium',
  'coins_large',
  'energy_refill',
  'income_x2',
] as const;
export type ShopProductId = (typeof SHOP_PRODUCT_IDS)[number];
export type ShopProductKind = 'coins' | 'energy' | 'income_boost';

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
