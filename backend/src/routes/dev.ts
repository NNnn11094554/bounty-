import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signInitData } from '../auth/initData.js';
import { env } from '../env.js';

const query = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).default(100_000_001),
  first_name: z.string().max(64).default('Dev'),
  last_name: z.string().max(64).optional(),
  username: z.string().max(64).default('dev_cat'),
  language: z.string().max(8).default('ru'),
  premium: z
    .enum(['0', '1', 'true', 'false'])
    .default('0')
    .transform((v) => v === '1' || v === 'true'),
  start_param: z.string().max(64).optional(),
});

/**
 * Только для development/test: выдаёт initData, подписанный токеном бота, чтобы игру
 * можно было открыть в обычном браузере. В production маршрут не регистрируется.
 */
export async function devRoutes(app: FastifyInstance): Promise<void> {
  if (env.isProd) return;
  app.get('/api/dev/init-data', { config: { public: true } }, async (request) => {
    const q = query.parse(request.query);
    const initData = signInitData(
      {
        user: {
          id: q.id,
          first_name: q.first_name,
          last_name: q.last_name,
          username: q.username,
          language_code: q.language,
          is_premium: q.premium,
          allows_write_to_pm: true,
        },
        startParam: q.start_param ?? null,
      },
      env.BOT_TOKEN,
    );
    return { initData };
  });
}
