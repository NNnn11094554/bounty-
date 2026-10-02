/**
 * Форматирование игровых чисел.
 *  - полные числа: разделитель тысяч — неразрывный пробел: 44 739 415
 *  - сокращения: 767,2K · 10,45K · 1,02M · 1B (в RU дробная часть через запятую, в EN — через точку)
 */

export type Locale = 'ru' | 'en';

const NBSP = ' ';
const UNITS: ReadonlyArray<readonly [number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

function sep(locale: Locale): string {
  return locale === 'ru' ? ',' : '.';
}

/** 44739415 → "44 739 415" (дробная часть отбрасывается). */
export function formatInt(value: number | bigint): string {
  const n = typeof value === 'bigint' ? value : BigInt(Math.trunc(Number.isFinite(value) ? value : 0));
  const negative = n < 0n;
  const digits = (negative ? -n : n).toString();
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

/**
 * 767200 → "767,2K", 10450 → "10,45K", 1024000 → "1,02M", 999 → "999".
 * Не больше 4 значащих цифр и 2 знаков после запятой; округление вниз,
 * чтобы не показывать больше, чем есть на самом деле.
 */
export function formatShort(value: number, locale: Locale = 'ru'): string {
  if (!Number.isFinite(value)) return '0';
  const negative = value < 0;
  const abs = Math.abs(value);
  const unit = UNITS.find(([size]) => abs >= size);
  if (!unit) return (negative ? '-' : '') + formatInt(Math.floor(abs));
  const [size, suffix] = unit;
  const scaled = abs / size;
  const intDigits = Math.floor(scaled).toString().length;
  const decimals = Math.max(0, Math.min(2, 4 - intDigits));
  const factor = 10 ** decimals;
  // небольшой эпсилон против артефактов вида 1.0199999
  const truncated = Math.floor(scaled * factor + 1e-9) / factor;
  let text = truncated.toFixed(decimals);
  if (decimals > 0) text = text.replace(/\.?0+$/, '');
  if (scaled >= 1000 && suffix === 'T') text = formatInt(Math.floor(scaled));
  return (negative ? '-' : '') + text.replace('.', sep(locale)) + suffix;
}

/** Знак «+» для положительных приростов: "+767,2K". */
export function formatSigned(value: number, locale: Locale = 'ru'): string {
  return (value > 0 ? '+' : '') + formatShort(value, locale);
}

/** Секунды → "00:29:19" (часы не ограничены: "26:00:00"). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}
