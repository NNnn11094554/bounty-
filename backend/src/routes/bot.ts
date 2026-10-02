import { timingSafeEqual } from 'node:crypto';
import type { Update } from 'grammy/types';
import type { FastifyInstance } from 'fastify';
import { getBot, webhookSecret } from '../bot/runtime.js';

function secretMatches(header: unknown): boolean {
  if (typeof header !== 'string') return false;
  const expected = Buffer.from(webhookSecret());
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Вебхук Telegram: принимает обновления только с секретом, заданным при setWebhook. */
export async function botRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/bot/webhook', { config: { public: true } }, async (request, reply) => {
    if (!secretMatches(request.headers['x-telegram-bot-api-secret-token'])) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Bad secret' } });
    }
    const bot = getBot();
    if (!bot.isInited()) {
      return reply.status(503).send({ error: { code: 'UNAVAILABLE', message: 'Bot is starting' } });
    }
    try {
      await bot.handleUpdate(request.body as Update);
    } catch (err) {
      // ошибка обработки не должна заставлять Telegram повторять обновление бесконечно
      request.log.error({ err }, 'webhook update failed');
    }
    return { ok: true };
  });
}
