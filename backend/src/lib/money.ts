import { Prisma } from '@prisma/client';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export const ZERO = new Prisma.Decimal(0);

export function D(value: number | bigint | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(typeof value === 'bigint' ? value.toString() : value);
}

/** Целая часть для клиента (монеты показываются без дробей). Деньги < 2^53. */
export function toCoins(value: Prisma.Decimal | bigint | number): number {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'bigint') return Number(value);
  return value.floor().toNumber();
}
