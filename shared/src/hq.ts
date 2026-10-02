/**
 * Штаб-квартиры: вымышленные города компании. Чисто косметика — название и фон шапки Офиса.
 * Первый выбор приносит награду (задание «Выбери штаб-квартиру»).
 */
import { CARD_PALETTES, type Localized } from './cards.js';

/** Награда за первый выбор штаб-квартиры (задание «Выбери штаб-квартиру»). */
export const HQ_REWARD = 5_000;

export interface Headquarters {
  id: string;
  name: Localized;
  /** рисунок эмблемы (из каталога рисунков карточек) */
  glyph: string;
  /** палитра эмблемы и фона шапки (индекс в CARD_PALETTES) */
  palette: number;
}

export const HEADQUARTERS: readonly Headquarters[] = [
  { id: 'purr_valley', name: { ru: 'Мурчащая долина', en: 'Purr Valley' }, glyph: 'leaf', palette: 4 },
  { id: 'whisker_bay', name: { ru: 'Усатая бухта', en: 'Whisker Bay' }, glyph: 'whiskers', palette: 3 },
  { id: 'paw_city', name: { ru: 'Лапа-Сити', en: 'Paw City' }, glyph: 'skyscraper', palette: 1 },
  { id: 'catnip_heights', name: { ru: 'Мятные высоты', en: 'Catnip Heights' }, glyph: 'castle', palette: 2 },
  { id: 'moon_harbor', name: { ru: 'Лунная гавань', en: 'Moon Harbor' }, glyph: 'moon', palette: 9 },
  { id: 'tuna_island', name: { ru: 'Тунцовый остров', en: 'Tuna Island' }, glyph: 'fish', palette: 0 },
];

/** Иконка эмблемы в формате карточек: "glyph/badge/palette". */
export function hqIcon(hq: Headquarters): string {
  return `${hq.glyph}/none/${hq.palette}`;
}

/** Цвета штаб-квартиры: [светлый, тёмный]. */
export function hqColors(hq: Headquarters): readonly [string, string] {
  return CARD_PALETTES[hq.palette] ?? CARD_PALETTES[0];
}

export function headquartersById(id: string | null | undefined): Headquarters | null {
  return HEADQUARTERS.find((h) => h.id === id) ?? null;
}

export interface HqRequest {
  hqId: string;
}
