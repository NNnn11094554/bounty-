import type { ShopProductId, ShopProductKind } from '@meowgul/shared';

interface ProductConfig {
  kind: ShopProductKind;
  /** цена в Telegram Stars */
  stars: number;
  /** пакет монет: столько часов текущего дохода (но не меньше min); буст: длительность */
  hours?: number;
  /** пакет монет: минимум монет (новичкам без дохода) */
  min?: number;
  popular?: boolean;
}

/**
 * Магазин за Telegram Stars. Меняйте цены и количества здесь — сервер и клиент возьмут их отсюда.
 * Пакеты монет растут вместе с доходом игрока, поэтому полезны на любом этапе игры.
 * Купленные монеты не идут в «всего заработано»: лигу и рейтинг купить нельзя.
 */
export const SHOP: Record<ShopProductId, ProductConfig> = {
  coins_small: { kind: 'coins', stars: 25, hours: 3, min: 25_000 },
  coins_medium: { kind: 'coins', stars: 100, hours: 15, min: 150_000, popular: true },
  coins_large: { kind: 'coins', stars: 250, hours: 45, min: 500_000 },
  energy_refill: { kind: 'energy', stars: 10 },
  income_x2: { kind: 'income_boost', stars: 150, hours: 24 },
};

/** Монет в пакете для игрока с таким доходом в час. */
export function packCoins(id: ShopProductId, profitPerHour: number): number {
  const p = SHOP[id];
  if (p.kind !== 'coins') return 0;
  return Math.max(p.min ?? 0, Math.round(profitPerHour * (p.hours ?? 0)));
}
