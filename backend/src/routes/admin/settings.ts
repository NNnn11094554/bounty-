import type { AdminSettings } from '@meowgul/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nextHappyHour } from '../../services/events.js';
import { requireAdmin } from '../../services/player.js';
import { getAppSettings, invalidateSettingsCache, setAppSetting } from '../../services/settings.js';

const HOUR = 3_600_000;

const SettingsBody = z
  .object({
    maintenance: z.object({ enabled: z.boolean(), message: z.string().trim().max(300) }),
    minClientVersion: z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,6}$/),
    happyHour: z.object({
      auto: z.boolean(),
      override: z
        .object({
          startsAt: z.string().datetime(),
          endsAt: z.string().datetime(),
          multiplier: z.number().int().min(2).max(5),
        })
        .refine((o) => Date.parse(o.endsAt) > Date.parse(o.startsAt), 'End must be after start')
        .refine((o) => Date.parse(o.endsAt) - Date.parse(o.startsAt) <= 24 * HOUR, 'At most 24 hours')
        .nullable(),
    }),
    goldenCoin: z.object({ enabled: z.boolean() }),
  })
  .partial()
  .strict();

async function view(): Promise<AdminSettings> {
  invalidateSettingsCache();
  const s = await getAppSettings();
  return { ...s, nextHappyHour: nextHappyHour(s, new Date()) };
}

/** Глобальные настройки: техработы, минимальная версия клиента, счастливый час, золотая монета. */
export async function adminSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/settings', async (request): Promise<AdminSettings> => {
    await requireAdmin(request);
    return view();
  });

  app.put('/api/admin/settings', async (request): Promise<AdminSettings> => {
    const admin = await requireAdmin(request);
    const body = SettingsBody.parse(request.body);
    for (const [key, value] of Object.entries(body)) {
      await setAppSetting(key as keyof typeof body, value as never);
    }
    request.log.warn({ admin: admin.telegramId.toString(), settings: body }, 'admin: settings changed');
    return view();
  });
}
