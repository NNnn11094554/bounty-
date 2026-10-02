import type { PlayerState } from '@meowgul/shared';
import { api, ApiError } from '../api/client';
import { translate, type MessageKey } from '../i18n';
import { playSound } from '../lib/sound';
import { useGame } from '../store/game';
import { toast } from '../store/toasts';
import { haptic } from '../telegram/webapp';
import { tapEngine } from './tapEngine';

export interface ActionOptions<T extends { state: PlayerState }> {
  request: () => Promise<T>;
  /** оптимистичное предсказание результата — показывается сразу, откатывается при ошибке */
  predict?: (state: PlayerState) => PlayerState;
  /** текст ошибки по коду (undefined — стандартный для кода) */
  errorKey?: (err: ApiError) => MessageKey | undefined;
}

const ERROR_KEYS: Partial<Record<string, MessageKey>> = {
  INSUFFICIENT_FUNDS: 'action.error.funds',
  COOLDOWN: 'action.error.cooldown',
  LIMIT_REACHED: 'action.error.limit',
  LOCKED: 'action.error.locked',
  ALREADY_DONE: 'action.error.done',
  NETWORK: 'net.offline',
  TIMEOUT: 'net.offline',
  RATE_LIMITED: 'action.error.rate',
};

/**
 * Игровое действие: сначала отправляем накопленные тапы (баланс должен совпадать),
 * показываем предсказанный результат, затем подтверждаем ответом сервера; при ошибке — откат и тост.
 */
export async function runAction<T extends { state: PlayerState }>(opts: ActionOptions<T>): Promise<T | null> {
  const before = tapEngine.snapshotNow();
  if (opts.predict && before) tapEngine.applyServerState(opts.predict(before));
  try {
    await tapEngine.flush();
    const res = await opts.request();
    tapEngine.applyServerState(res.state);
    return res;
  } catch (err) {
    if (before) tapEngine.applyServerState(before);
    const locale = useGame.getState().locale;
    const apiErr = err instanceof ApiError ? err : null;
    const key = (apiErr && (opts.errorKey?.(apiErr) ?? ERROR_KEYS[apiErr.code])) ?? 'action.error.generic';
    if (!apiErr || !['BANNED', 'MAINTENANCE', 'OUTDATED_CLIENT', 'UNAUTHORIZED'].includes(apiErr.code)) {
      toast.error(translate(locale, key));
      haptic.notify('error');
      playSound('error');
    }
    // сверяемся с сервером, чтобы не остаться в предсказанном состоянии
    void api<{ state: PlayerState }>('/api/state', { silent: true })
      .then((r) => tapEngine.applyServerState(r.state))
      .catch(() => undefined);
    return null;
  }
}
