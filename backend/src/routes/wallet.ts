import type { StateResponse, TonProofPayloadResponse } from '@meowgul/shared';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { ApiError } from '../lib/errors.js';
import { requirePlayer } from '../services/player.js';
import { applyBalanceChanges } from '../services/ledger.js';
import { buildPlayerState } from '../services/state.js';
import { createProofPayload, verifyTonProof } from '../services/tonProof.js';
import { withUserLock } from '../services/userLock.js';

const ConnectBody = z.object({
  address: z.string().trim().min(10).max(100),
  network: z.string().max(10),
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  proof: z.object({
    timestamp: z.number().int().positive(),
    domain: z.object({ lengthBytes: z.number().int().min(1).max(253), value: z.string().min(1).max(253) }),
    signature: z.string().min(1).max(200),
    payload: z.string().max(200),
    stateInit: z.string().min(1).max(10_000),
  }),
});

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  /** Манифест TON Connect: кошельки показывают по нему название и иконку игры. */
  app.get('/api/tonconnect-manifest.json', { config: { public: true } }, async (_request, reply) => {
    const base = env.WEBAPP_URL.replace(/\/$/, '');
    reply.header('Access-Control-Allow-Origin', '*').header('Cache-Control', 'public, max-age=3600');
    return { url: base, name: 'Meowgul', iconUrl: `${base}/assets/generated/icon-192.png` };
  });

  /** Подписанный payload для ton_proof (действует 15 минут, привязан к игроку). */
  app.get('/api/wallet/proof-payload', async (request): Promise<TonProofPayloadResponse> => {
    const user = await requirePlayer(request);
    return createProofPayload(user.id);
  });

  app.post(
    '/api/wallet',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request): Promise<StateResponse> => {
      const body = ConnectBody.parse(request.body);
      const player = await requirePlayer(request);
      const check = verifyTonProof(
        player.id,
        { address: body.address, network: body.network, publicKey: body.publicKey.toLowerCase() },
        body.proof,
      );
      if (!check.ok) {
        request.log.warn({ userId: player.id, reason: check.reason }, 'ton_proof rejected');
        throw new ApiError('VALIDATION', 'Wallet ownership is not confirmed', { reason: check.reason });
      }
      const raw = check.address.toRawString();
      const connect = () =>
        withUserLock(player.id, async (tx, user) => {
          const now = new Date();
          const owner = await tx.user.findUnique({ where: { walletAddress: raw }, select: { id: true } });
          if (owner && owner.id !== user.id) {
            throw new ApiError('CONFLICT', 'This wallet is already connected to another player');
          }
          // задания «подключи кошелёк» засчитываются один раз
          const tasks = await tx.task.findMany({
            where: {
              type: 'CONNECT_WALLET',
              isActive: true,
              users: { none: { userId: user.id, status: 'DONE' } },
            },
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
              type: 'task_reward' as const,
              amount: Number(t.reward),
              meta: { taskId: t.id },
            })),
            { walletAddress: raw, walletConnectedAt: now },
            now,
          );
          request.log.info({ userId: user.id }, 'wallet connected');
          return { state: buildPlayerState(updated, now) };
        });
      try {
        return await connect();
      } catch (err) {
        // тот же кошелёк одновременно подключает другой игрок — уникальность адреса в БД
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ApiError('CONFLICT', 'This wallet is already connected to another player');
        }
        throw err;
      }
    },
  );

  app.delete('/api/wallet', async (request): Promise<StateResponse> => {
    const player = await requirePlayer(request);
    return withUserLock(player.id, async (tx) => {
      const now = new Date();
      const updated = await tx.user.update({
        where: { id: player.id },
        data: { walletAddress: null, walletConnectedAt: null },
      });
      return { state: buildPlayerState(updated, now) };
    });
  });
}
