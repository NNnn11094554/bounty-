import { ApiError } from '../api/client';
import { toast } from '../store/toasts';
import { getWebApp } from '../telegram/webapp';

/** Подтверждение действия: нативный диалог Telegram, вне Telegram — браузерный. */
export function confirmAction(message: string): Promise<boolean> {
  const app = getWebApp();
  if (app?.showConfirm && app.isVersionAtLeast('6.2')) {
    return new Promise((resolve) => app.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

/** Ошибка запроса админки — тостом с текстом сервера. */
export function reportError(err: unknown): void {
  if (err instanceof ApiError) {
    const issues = (err.details?.issues as Array<{ path?: unknown[]; message?: string }> | undefined) ?? [];
    const detail = issues.map((i) => `${(i.path ?? []).join('.')}: ${i.message ?? ''}`).join('; ');
    toast.error(`${err.code}: ${detail || err.message}`);
  } else {
    toast.error(String(err));
  }
}

/** Выполнить запрос админки: ошибки показываются тостом, результат null. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    reportError(err);
    return null;
  }
}

/** "2026-10-02T13:45" для input[type=datetime-local] в локальном времени и обратно. */
export function toLocalInput(ms: number | null): string {
  if (ms === null) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatDateTime(ms: number, locale: 'ru' | 'en'): string {
  return new Date(ms).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
