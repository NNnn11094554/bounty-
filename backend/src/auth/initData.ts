import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Проверка Telegram.WebApp.initData по алгоритму из документации Telegram:
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
 * data_check_string — все поля, кроме hash, отсортированные по ключу, в виде "key=value", через \n.
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
  allows_write_to_pm?: boolean;
}

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: Date;
  startParam: string | null;
  queryId: string | null;
  chatType: string | null;
}

export class InitDataError extends Error {}

export const INIT_DATA_MAX_AGE_SEC = 24 * 3600;
const MAX_FUTURE_SKEW_SEC = 60;

function secretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken).digest();
}

export function dataCheckString(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function computeHash(params: URLSearchParams, botToken: string): string {
  return createHmac('sha256', secretKey(botToken)).update(dataCheckString(params)).digest('hex');
}

export function validateInitData(
  raw: string,
  botToken: string,
  opts: { now?: Date; maxAgeSec?: number } = {},
): ValidatedInitData {
  if (!raw || raw.length > 8192) throw new InitDataError('initData is empty or too long');
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) throw new InitDataError('hash is missing');

  const expected = Buffer.from(computeHash(params, botToken), 'hex');
  const actual = Buffer.from(hash, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new InitDataError('signature mismatch');
  }

  const authDateSec = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSec) || authDateSec <= 0) throw new InitDataError('auth_date is invalid');
  const nowSec = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (nowSec - authDateSec > (opts.maxAgeSec ?? INIT_DATA_MAX_AGE_SEC))
    throw new InitDataError('initData expired');
  if (authDateSec - nowSec > MAX_FUTURE_SKEW_SEC) throw new InitDataError('auth_date is in the future');

  const userRaw = params.get('user');
  if (!userRaw) throw new InitDataError('user is missing');
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new InitDataError('user is not valid JSON');
  }
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.first_name !== 'string') {
    throw new InitDataError('user is invalid');
  }

  return {
    user,
    authDate: new Date(authDateSec * 1000),
    startParam: params.get('start_param'),
    queryId: params.get('query_id'),
    chatType: params.get('chat_type'),
  };
}

/** Подписать initData токеном бота — для dev-режима и тестов. */
export function signInitData(
  fields: { user: TelegramUser; authDate?: Date; startParam?: string | null; queryId?: string },
  botToken: string,
): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor((fields.authDate ?? new Date()).getTime() / 1000)));
  params.set('query_id', fields.queryId ?? `AAH${Math.random().toString(36).slice(2, 12)}`);
  params.set('user', JSON.stringify(fields.user));
  if (fields.startParam) params.set('start_param', fields.startParam);
  params.set('hash', computeHash(params, botToken));
  return params.toString();
}
