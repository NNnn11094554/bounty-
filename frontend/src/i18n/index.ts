import type { Locale } from '@meowgul/shared';
import { useGame } from '../store/game';
import { en } from './en';
import { ru, type MessageKey } from './ru';

export type { MessageKey };
type Vars = Record<string, string | number>;

const DICTS: Record<Locale, Record<MessageKey, string>> = { ru, en };

/** Язык: настройка игрока → язык Telegram → язык браузера. */
export function resolveLocale(setting: Locale | null | undefined, telegram: string | undefined): Locale {
  if (setting) return setting;
  const lang = (telegram ?? (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase();
  return /^(ru|uk|be|kk|uz|ky|tg|hy|az)/.test(lang) ? 'ru' : 'en';
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  let text: string = DICTS[locale][key] ?? ru[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

/** Русская плюрализация: 1 друг / 2 друга / 5 друзей. */
export function plural(locale: Locale, n: number, forms: { one: string; few: string; many: string }): string {
  if (locale === 'en') return Math.abs(n) === 1 ? forms.one : forms.many;
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n10 === 1 && n100 !== 11) return forms.one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms.few;
  return forms.many;
}

export function useLocale(): Locale {
  return useGame((s) => s.locale);
}

export function useT(): (key: MessageKey, vars?: Vars) => string {
  const locale = useLocale();
  return (key, vars) => translate(locale, key, vars);
}
