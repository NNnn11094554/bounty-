import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CIPHER_WORD_RE } from '../../game/config/ciphers.js';
import { dayKey } from '../../game/dayKey.js';
import { ApiError } from '../../lib/errors.js';
import { prisma } from '../../lib/db.js';
import { getCatalog } from '../../services/cards.js';
import { COMBO_SIZE } from '../../services/dailyGames.js';
import { requireAdmin } from '../../services/player.js';

const DAY = 86_400_000;
const DayParams = z.object({ dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const ComboBody = z.object({ cardIds: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/)).length(COMBO_SIZE) });
const CipherBody = z.object({
  word: z
    .string()
    .trim()
    .transform((w) => w.toUpperCase())
    .pipe(z.string().regex(CIPHER_WORD_RE, 'Word: 4–7 Latin letters')),
  hintRu: z.string().trim().max(160).default(''),
  hintEn: z.string().trim().max(160).default(''),
});

export interface AdminDailyDay {
  dayKey: string;
  combo: { cardIds: string[]; source: string } | null;
  cipher: { word: string; hintRu: string; hintEn: string; source: string } | null;
}

function assertNotPast(key: string): void {
  if (key < dayKey(new Date())) throw new ApiError('VALIDATION', 'Past days cannot be changed');
}

/** Комбо и шифр дня на неделю вперёд (админка). */
export async function adminDailyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/daily', async (request): Promise<{ days: AdminDailyDay[] }> => {
    await requireAdmin(request);
    const today = Date.parse(`${dayKey(new Date())}T00:00:00Z`);
    const keys = Array.from({ length: 7 }, (_, i) => new Date(today + i * DAY).toISOString().slice(0, 10));
    const [combos, ciphers] = await Promise.all([
      prisma.dailyCombo.findMany({ where: { dayKey: { in: keys } } }),
      prisma.dailyCipher.findMany({ where: { dayKey: { in: keys } } }),
    ]);
    return {
      days: keys.map((key) => {
        const combo = combos.find((c) => c.dayKey === key);
        const cipher = ciphers.find((c) => c.dayKey === key);
        return {
          dayKey: key,
          combo: combo ? { cardIds: combo.cardIds, source: combo.source } : null,
          cipher: cipher
            ? { word: cipher.word, hintRu: cipher.hintRu, hintEn: cipher.hintEn, source: cipher.source }
            : null,
        };
      }),
    };
  });

  app.put('/api/admin/combo/:dayKey', async (request): Promise<{ ok: true }> => {
    await requireAdmin(request);
    const { dayKey: key } = DayParams.parse(request.params);
    const { cardIds } = ComboBody.parse(request.body);
    assertNotPast(key);
    if (new Set(cardIds).size !== cardIds.length) throw new ApiError('VALIDATION', 'Cards must be different');
    const catalog = await getCatalog();
    for (const id of cardIds) {
      const card = catalog.find((c) => c.id === id);
      if (!card || !card.isActive) throw new ApiError('VALIDATION', `Unknown or inactive card ${id}`);
    }
    await prisma.dailyCombo.upsert({
      where: { dayKey: key },
      create: { dayKey: key, cardIds, source: 'admin' },
      update: { cardIds, source: 'admin' },
    });
    request.log.warn({ admin: request.tg?.user.id, dayKey: key, cardIds }, 'admin: combo set');
    return { ok: true };
  });

  app.put('/api/admin/cipher/:dayKey', async (request): Promise<{ ok: true }> => {
    await requireAdmin(request);
    const { dayKey: key } = DayParams.parse(request.params);
    const body = CipherBody.parse(request.body);
    assertNotPast(key);
    await prisma.dailyCipher.upsert({
      where: { dayKey: key },
      create: { dayKey: key, ...body, source: 'admin' },
      update: { ...body, source: 'admin' },
    });
    request.log.warn({ admin: request.tg?.user.id, dayKey: key }, 'admin: cipher set');
    return { ok: true };
  });
}
