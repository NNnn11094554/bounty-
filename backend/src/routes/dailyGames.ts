import type { CipherClaimResponse, DailyGamesResponse } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cipherReward } from '../game/config/rewards.js';
import { dayKey, nextResetAt } from '../game/dayKey.js';
import { ApiError } from '../lib/errors.js';
import { prisma } from '../lib/db.js';
import { cipherForDay, cipherState, comboForDay, comboState } from '../services/dailyGames.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { requirePlayer } from '../services/player.js';
import { buildPlayerState } from '../services/state.js';
import { syncPassive } from '../services/sync.js';
import { withUserLock } from '../services/userLock.js';
import { checkAchievements } from '../services/achievements.js';

const CipherBody = z.object({
  word: z
    .string()
    .trim()
    .max(16)
    .transform((w) => w.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]+$/)),
});

export async function dailyGameRoutes(app: FastifyInstance): Promise<void> {
  /** Комбо и шифр текущего игрового дня. */
  app.get('/api/combo', async (request): Promise<DailyGamesResponse> => {
    const user = await requirePlayer(request);
    const now = new Date();
    const key = dayKey(now);
    const [combo, cipher, progress, solved] = await Promise.all([
      comboForDay(key),
      cipherForDay(key),
      prisma.userComboProgress.findUnique({ where: { userId_dayKey: { userId: user.id, dayKey: key } } }),
      prisma.userCipher.findUnique({ where: { userId_dayKey: { userId: user.id, dayKey: key } } }),
    ]);
    return {
      combo: await comboState(combo, progress, Number(user.profitPerHour)),
      cipher: cipherState(cipher, solved?.solved ?? false, Number(user.profitPerHour)),
      nextResetAt: nextResetAt(now).getTime(),
    };
  });

  app.post(
    '/api/cipher/claim',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request): Promise<CipherClaimResponse> => {
      const { word } = CipherBody.parse(request.body);
      const player = await requirePlayer(request);
      // неверная попытка сохраняется (счётчик попыток), поэтому ошибка бросается после транзакции
      const result = await withUserLock(
        player.id,
        async (tx, locked): Promise<CipherClaimResponse | null> => {
          const now = new Date();
          const key = dayKey(now);
          const cipher = await cipherForDay(key, tx);
          const entry = await tx.userCipher.upsert({
            where: { userId_dayKey: { userId: locked.id, dayKey: key } },
            create: { userId: locked.id, dayKey: key },
            update: {},
          });
          if (entry.solved) throw new ApiError('ALREADY_DONE', 'Cipher is already solved today');
          if (word !== cipher.word) {
            await tx.userCipher.update({
              where: { userId_dayKey: { userId: locked.id, dayKey: key } },
              data: { attempts: { increment: 1 } },
            });
            return null;
          }
          const { user } = await syncPassive(tx, locked, now);
          const reward = cipherReward(Number(user.profitPerHour));
          const updated = await applyBalanceChanges(
            tx,
            user,
            [{ type: 'cipher_reward', amount: reward, meta: { dayKey: key } }],
            {},
            now,
          );
          await tx.userCipher.update({
            where: { userId_dayKey: { userId: user.id, dayKey: key } },
            data: { solved: true, attempts: { increment: 1 } },
          });
          const final = await checkAchievements(tx, updated, now, ['ciphers']);
          return {
            state: buildPlayerState(final, now),
            cipher: cipherState(cipher, true, Number(user.profitPerHour)),
            reward,
          };
        },
      );
      if (!result) throw new ApiError('NOT_COMPLETED', 'Wrong word');
      return result;
    },
  );
}
