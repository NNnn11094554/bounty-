import type { AuthResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { ApiError } from '../lib/errors.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { recordActivity, upsertTelegramUser } from '../services/users.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** Вход/регистрация: возвращает полное состояние игрока. */
  app.post('/api/auth', async (request): Promise<AuthResponse> => {
    const tg = request.tg;
    if (!tg) throw new ApiError('UNAUTHORIZED', 'Missing Telegram init data');
    const now = new Date();
    const { user, isNew } = await upsertTelegramUser(tg, now);
    if (user.isBanned) throw new ApiError('BANNED', 'Account is banned', { reason: user.banReason });
    await recordActivity(user.id, now);
    return { state: buildPlayerState(user, now), offline: null, isNew };
  });

  app.get('/api/state', async (request): Promise<StateResponse> => {
    const user = await requirePlayer(request);
    return { state: buildPlayerState(user) };
  });
}
