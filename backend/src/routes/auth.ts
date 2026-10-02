import type { AuthResponse, StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { clientConfig } from '../game/config/index.js';
import { GAME } from '../game/config/game.js';
import { ApiError } from '../lib/errors.js';
import { toCoins } from '../lib/money.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';
import { applyReferral, type ReferralResult } from '../services/referrals.js';
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
    // приглашение засчитывается только новому игроку
    let referral: ReferralResult | null = null;
    if (isNew && tg.startParam) {
      try {
        referral = await applyReferral(user, tg.startParam);
      } catch (err) {
        request.log.error({ err, startParam: tg.startParam }, 'referral failed');
      }
    }
    // доход карточек за время отсутствия (не больше 3 часов)
    const { user: synced, passive } = await withUserLock(user.id, (tx, locked) =>
      syncPassive(tx, locked, now),
    );
    const earned = toCoins(passive.amount);
    const offline =
      passive.elapsedSeconds >= GAME.passive.offlineModalMinSec && earned > 0
        ? { earned, seconds: passive.elapsedSeconds, creditedSeconds: passive.creditedSeconds }
        : null;
    return { state: buildPlayerState(synced, now), config: clientConfig(), offline, isNew, referral };
  });

  app.get('/api/state', async (request): Promise<StateResponse> => {
    const player = await requirePlayer(request);
    const now = new Date();
    const { user } = await withUserLock(player.id, (tx, locked) => syncPassive(tx, locked, now));
    return { state: buildPlayerState(user, now) };
  });
}
