/**
 * Контракт API между клиентом и сервером. Все игровые числа считает сервер;
 * денежные значения передаются как number (целые монеты, < 2^53).
 */

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'BANNED'
  | 'MAINTENANCE'
  | 'OUTDATED_CLIENT'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'COOLDOWN'
  | 'LOCKED'
  | 'LIMIT_REACHED'
  | 'ALREADY_DONE'
  | 'CONFLICT'
  | 'INTERNAL';

export interface HealthResponse {
  status: 'ok';
  version: string;
  time: string;
}
