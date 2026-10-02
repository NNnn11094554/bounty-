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
import { referralForNewPlayer, type ReferralResult } from '../services/referrals.js';
import { recordActivity, upsertTelegramUser } from '../services/users.js';
import { checkAchievements, COUNTED_METRICS } from '../services/achievements.js';

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
    // (из start_param ссылки на Mini App или из /start в боте — PendingReferral)
    let referral: ReferralResult | null = null;
    if (isNew) {
      try {
        referral = await referralForNewPlayer(user, tg.startParam ?? null);
      } catch (err) {
        request.log.error({ err, startParam: tg.startParam }, 'referral failed');
      }
    }
    // доход карточек за время отсутствия (не больше 3 часов)
    // заодно проверяем все достижения: новые в конфиге или пропущенные выдаются при входе
    const { user: synced, passive } = await withUserLock(user.id, async (tx, locked) => {
      const res = await syncPassive(tx, locked, now);
      return { ...res, user: await checkAchievements(tx, res.user, now, COUNTED_METRICS) };
    });
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
    // состояние запрашивается и при смене игрового дня — отмечаем активность за новый день
    await recordActivity(player.id, now);
    const { user } = await withUserLock(player.id, (tx, locked) => syncPassive(tx, locked, now));
    return { state: buildPlayerState(user, now) };
  });
}
