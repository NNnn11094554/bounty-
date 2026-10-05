import { create } from 'zustand';
import { en, type Dict } from './en';

export type { Dict };

/**
 * Языки сайта. Английский встроен (он же запасной), остальные словари грузятся отдельным маленьким файлом,
 * только когда язык выбран. Новый язык: словарь <code>.ts с типом Dict (структура — как у en.ts) и строка
 * здесь — переключатель, сохранение выбора и определение по браузеру подхватят его сами.
 */
export const LOCALES = [
  { code: 'en', name: 'English', html: 'en', load: async () => en },
  { code: 'ru', name: 'Русский', html: 'ru', load: async () => (await import('./ru')).ru },
  { code: 'uk', name: 'Українська', html: 'uk', load: async () => (await import('./uk')).uk },
  { code: 'zh', name: '中文', html: 'zh-CN', load: async () => (await import('./zh')).zh },
  { code: 'ja', name: '日本語', html: 'ja', load: async () => (await import('./ja')).ja },
  { code: 'ko', name: '한국어', html: 'ko', load: async () => (await import('./ko')).ko },
  { code: 'es', name: 'Español', html: 'es', load: async () => (await import('./es')).es },
  { code: 'pt', name: 'Português', html: 'pt', load: async () => (await import('./pt')).pt },
  { code: 'fr', name: 'Français', html: 'fr', load: async () => (await import('./fr')).fr },
  { code: 'de', name: 'Deutsch', html: 'de', load: async () => (await import('./de')).de },
] as const satisfies ReadonlyArray<{ code: string; name: string; html: string; load: () => Promise<Dict> }>;

export type LocaleCode = (typeof LOCALES)[number]['code'];

const STORAGE_KEY = 'meowgul.site.locale';
const byCode = (code: string) => LOCALES.find((l) => l.code === code);

/** Язык при первом визите: сохранённый выбор → язык браузера (белорусский и казахский — русский) → English. */
export function detectLocale(saved: string | null, browser: readonly string[]): LocaleCode {
  if (saved && byCode(saved)) return saved as LocaleCode;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0]!;
    if (byCode(base)) return base as LocaleCode;
    if (base === 'be' || base === 'kk') return 'ru';
  }
  return 'en';
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface LangState {
  locale: LocaleCode;
  dict: Dict;
  setLocale: (code: LocaleCode, dict: Dict) => void;
}

/** Язык, который нужен при открытии (сохранённый или язык браузера). Его словарь грузит loadInitialLocale. */
const initial = detectLocale(
  typeof window === 'undefined' ? null : readSaved(),
  typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
);

export const useLang = create<LangState>((set) => ({
  locale: 'en',
  dict: en,
  setLocale: (locale, dict) => set({ locale, dict }),
}));

/** Загрузить словарь языка при открытии — до первой отрисовки (без мелькания английского). */
export async function loadInitialLocale(): Promise<void> {
  if (initial === 'en') return;
  try {
    useLang.getState().setLocale(initial, await byCode(initial)!.load());
  } catch {
    // словарь не загрузился (сеть) — сайт откроется на английском
  }
}

/** Словарь текущего языка (компонент перерисуется при смене языка). */
export function useT(): Dict {
  return useLang((s) => s.dict);
}

/** Подстановка: fmt('Day {day}', { day: 3 }) → 'Day 3'. */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** Язык документа, заголовок и описание страницы — под текущий язык. */
export function applyDocumentLocale(code: LocaleCode, dict: Dict): void {
  document.documentElement.lang = byCode(code)!.html;
  document.title = dict.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', dict.meta.description);
}

const FADE_MS = 220;

/**
 * Смена языка без перезагрузки: страница мягко гаснет, текст меняется, страница проявляется (только opacity).
 * Выбор сохраняется — при следующем открытии сайт будет на этом языке.
 */
export async function switchLocale(code: LocaleCode): Promise<void> {
  if (useLang.getState().locale === code) return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // приватный режим: язык просто не запомнится
  }
  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // словарь грузится, пока текст гаснет — смена не ждёт сети дольше, чем нужно
  const dict = byCode(code)!.load();
  if (!reduced) root.dataset.switching = 'out';
  let loaded: Dict;
  try {
    [loaded] = await Promise.all([dict, new Promise((r) => setTimeout(r, reduced ? 0 : FADE_MS))]);
  } catch {
    // не загрузился (сеть) — остаётся прежний язык, текст проявляется обратно
    delete root.dataset.switching;
    return;
  }
  useLang.getState().setLocale(code, loaded);
  if (reduced) return;
  requestAnimationFrame(() => {
    root.dataset.switching = 'in';
    window.setTimeout(() => delete root.dataset.switching, FADE_MS);
  });
}
