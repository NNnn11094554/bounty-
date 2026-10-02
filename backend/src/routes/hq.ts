import { HEADQUARTERS, type StateResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';

const Body = z.object({
  hqId: z.enum(HEADQUARTERS.map((h) => h.id) as [string, ...string[]]),
});

export async function hqRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Выбор штаб-квартиры (завершает онбординг). Сменить можно в любой момент,
   * награда задания «Выбери штаб-квартиру» — только за первый выбор.
   */
  app.post('/api/hq', async (request): Promise<StateResponse> => {
    const { hqId } = Body.parse(request.body);
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx, locked) => {
      const now = new Date();
      const { user } = await syncPassive(tx, locked, now);
      const tasks = await tx.task.findMany({
        where: { type: 'CHOOSE_HQ', isActive: true, users: { none: { userId: user.id, status: 'DONE' } } },
      });
      for (const task of tasks) {
        await tx.userTask.upsert({
          where: { userId_taskId: { userId: user.id, taskId: task.id } },
          create: { userId: user.id, taskId: task.id, status: 'DONE', startedAt: now, completedAt: now },
          update: { status: 'DONE', completedAt: now },
        });
      }
      const updated = await applyBalanceChanges(
        tx,
        user,
        tasks.map((t) => ({
          type: 'hq_reward' as const,
          amount: Number(t.reward),
          meta: { taskId: t.id, hqId },
        })),
        { hqId, onboardingDone: true },
        now,
      );
      return { state: buildPlayerState(updated, now) };
    });
  });
}
