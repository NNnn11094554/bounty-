import type { ApiErrorBody, ApiErrorCode } from '@meowgul/shared';
import { APP_VERSION } from '../lib/version';

const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'TIMEOUT';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  get isNetwork(): boolean {
    return (
      this.code === 'NETWORK' ||
      this.code === 'TIMEOUT' ||
      (this.status >= 502 && this.status <= 504 && this.code !== 'MAINTENANCE')
    );
  }
}

let initData = '';
export function setInitData(value: string): void {
  initData = value;
}

type Listener = (err: ApiError) => void;
const globalListeners = new Set<Listener>();
/** Подписка на «глобальные» ошибки: бан, техработы, устаревший клиент, потеря авторизации. */
export function onGlobalApiError(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}
const GLOBAL_CODES: ReadonlySet<ClientErrorCode> = new Set([
  'BANNED',
  'MAINTENANCE',
  'OUTDATED_CLIENT',
  'UNAUTHORIZED',
]);

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** повторять при сетевых ошибках (по умолчанию — для GET) */
  retry?: boolean;
  timeoutMs?: number;
  /** не рассылать глобальные ошибки (для фоновых запросов) */
  silent?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('online', () => resolve(), { once: true }));
}

async function once<T>(path: string, opts: RequestOptions): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(
    () => ctrl.abort(new DOMException('timeout', 'TimeoutError')),
    opts.timeoutMs ?? 15_000,
  );
  const onAbort = () => ctrl.abort(opts.signal?.reason);
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `tma ${initData}`,
        'X-Client-Version': APP_VERSION,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      keepalive: path === '/api/tap',
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    const timedOut =
      err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new ApiError(timedOut ? 'TIMEOUT' : 'NETWORK', 0, timedOut ? 'Request timed out' : 'Network error');
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  throw new ApiError(
    body?.error?.code ?? (res.status >= 500 ? 'INTERNAL' : 'VALIDATION'),
    res.status,
    body?.error?.message ?? res.statusText,
    body?.error?.details,
  );
}

/** Запрос к API с initData, версией клиента, таймаутом и повтором при потере сети. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const retry = opts.retry ?? (opts.method ?? 'GET') === 'GET';
  let attempt = 0;
  for (;;) {
    try {
      return await once<T>(path, opts);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (GLOBAL_CODES.has(err.code) && !opts.silent) globalListeners.forEach((l) => l(err));
      if (!retry || !err.isNetwork || attempt >= 4) throw err;
      attempt++;
      await waitOnline();
      await sleep(Math.min(8000, 500 * 2 ** attempt) * (0.8 + Math.random() * 0.4));
    }
  }
}
