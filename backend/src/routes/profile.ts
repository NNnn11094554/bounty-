import {
  ACHIEVEMENTS,
  VISIBLE_ACHIEVEMENTS,
  ACHIEVEMENT_METRICS,
  TUTORIALS,
  type ProfileResponse,
  type StateResponse,
} from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { toCoins } from '../lib/money.js';
import { COUNTED_METRICS, countedMetrics, rowMetrics } from '../services/achievements.js';
import { clearLeaderboardCache } from '../services/leaderboard.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState, parseSettings } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const SettingsBody = z
  .object({
    language: z.enum(['ru', 'en']).nullable(),
    sound: z.boolean(),
    vibration: z.boolean(),
    animations: z.enum(['full', 'reduced']),
    notifications: z.boolean(),
  })
  .partial()
  .strict();

const SeenBody = z.object({
  ids: z.array(z.string().max(64)).min(1).max(ACHIEVEMENTS.length),
});

const TutorialParams = z.object({ id: z.enum(TUTORIALS) });

const DeleteBody = z.object({ confirm: z.literal(true) });

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  /** Профиль: статистика, достижения и прогресс по каждому показателю. */
  app.get('/api/profile', async (request): Promise<ProfileResponse> => {
    const player = await requirePlayer(request);
    const [unlocked, counted] = await Promise.all([
      prisma.userAchievement.findMany({ where: { userId: player.id } }),
      countedMetrics(prisma, player.id, COUNTED_METRICS),
    ]);
    const progress = { ...rowMetrics(player), ...counted };
    const at = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt.getTime()]));
    return {
      stats: {
        totalTaps: Number(player.totalTaps),
        totalEarned: toCoins(player.totalEarned),
        daysPlayed: progress.daysPlayed ?? 0,
        bestDailyStreak: player.bestDailyStreak,
        friends: progress.friends ?? 0,
        cards: progress.cards ?? 0,
        combos: progress.combos ?? 0,
        ciphers: progress.ciphers ?? 0,
      },
      achievements: VISIBLE_ACHIEVEMENTS.map((a) => ({ id: a.id, unlockedAt: at.get(a.id) ?? null })),
      progress: Object.fromEntries(ACHIEVEMENT_METRICS.map((m) => [m, progress[m] ?? 0])),
    };
  });

  /** Всплывающие уведомления о достижениях показаны — убрать их из списка новых. */
  app.post('/api/achievements/seen', async (request): Promise<StateResponse> => {
    const { ids } = SeenBody.parse(request.body);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const seen = new Set(ids);
      const updated = await tx.user.update({
        where: { id: locked.id },
        data: { newAchievementIds: locked.newAchievementIds.filter((id) => !seen.has(id)) },
      });
      const { user } = await syncPassive(tx, updated, now);
      return { state: buildPlayerState(user, now) };
    });
  });

  /** Настройки игрока: язык, звук, вибрация, анимации, уведомления бота. */
  app.patch('/api/settings', async (request): Promise<StateResponse> => {
    const patch = SettingsBody.parse(request.body);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const settings = { ...parseSettings(locked.settings), ...patch };
      const updated = await tx.user.update({ where: { id: locked.id }, data: { settings } });
      const { user } = await syncPassive(tx, updated, now);
      return { state: buildPlayerState(user, now) };
    });
  });

  /** Подсказка вкладки показана — больше не показывать. */
  app.post('/api/tutorials/:id/seen', async (request): Promise<StateResponse> => {
    const { id } = TutorialParams.parse(request.params);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const updated = locked.tutorialsSeen.includes(id)
        ? locked
        : await tx.user.update({ where: { id: locked.id }, data: { tutorialsSeen: { push: id } } });
      const { user } = await syncPassive(tx, updated, now);
      return { state: buildPlayerState(user, now) };
    });
  });

  /**
   * Удаление аккаунта со всем прогрессом. Telegram ID запоминается: при повторной регистрации
   * приглашение уже не засчитывается (иначе удаление можно использовать для накрутки бонусов).
   */
  app.post(
    '/api/account/delete',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (request): Promise<{ ok: true }> => {
      DeleteBody.parse(request.body);
      const player = await requirePlayer(request);
      await withUserLock(player.id, async (tx, locked) => {
        await tx.deletedUser.upsert({
          where: { telegramId: locked.telegramId },
          create: { telegramId: locked.telegramId },
          update: { deletedAt: new Date() },
        });
        await tx.user.delete({ where: { id: locked.id } });
      });
      clearLeaderboardCache();
      logger.info({ userId: player.id }, 'account deleted by player');
      return { ok: true };
    },
  );
}
