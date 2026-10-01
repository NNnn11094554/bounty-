import type { ApiErrorCode } from '@meowgul/shared';

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  BANNED: 403,
  MAINTENANCE: 503,
  OUTDATED_CLIENT: 426,
  RATE_LIMITED: 429,
  VALIDATION: 400,
  NOT_FOUND: 404,
  INSUFFICIENT_FUNDS: 409,
  COOLDOWN: 409,
  LOCKED: 409,
  LIMIT_REACHED: 409,
  ALREADY_DONE: 409,
  CONFLICT: 409,
  FORBIDDEN: 403,
  NOT_COMPLETED: 409,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

/** Ошибка бизнес-логики с кодом для клиента. */
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = STATUS[code];
  }
}
