import 'dotenv/config';
import { z } from 'zod';

const DEV_BOT_TOKEN = '1234567890:DEV_ONLY_TOKEN_not_for_production_use';

const bool = z
  .string()
  .optional()
  .transform((v) => ['1', 'true', 'yes', 'on'].includes((v ?? '').trim().toLowerCase()));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
    BOT_TOKEN: z.string().optional(),
    BOT_USERNAME: z.string().default('meowgul_bot'),
    MINIAPP_SHORT_NAME: z.string().default('app'),
    WEBAPP_URL: z.string().url().default('http://localhost:5173'),
    API_URL: z.string().url().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().optional(),
    ADMIN_TELEGRAM_IDS: z.string().default(''),
    /** единственный аккаунт с режимом разработчика; не задан — единственный админ (если он один) */
    DEVELOPER_TELEGRAM_ID: z
      .string()
      .regex(/^\d+$/, 'DEVELOPER_TELEGRAM_ID — числовой Telegram ID')
      .optional(),
    CHANNEL_ID: z.string().optional(),
    CHANNEL_URL: z.string().url().optional(),
    DAILY_RESET_UTC_HOUR: z.coerce.number().int().min(0).max(23).default(16),
    WEBHOOK_SECRET: z.string().optional(),
    BOT_ENABLED: bool,
    MIN_CLIENT_VERSION: z.string().default('1.0.0'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.BOT_TOKEN) {
      ctx.addIssue({ code: 'custom', path: ['BOT_TOKEN'], message: 'BOT_TOKEN обязателен в production' });
    }
    // Mini App и вебхук Telegram работают только по https
    for (const key of ['WEBAPP_URL', 'API_URL'] as const) {
      if (!env[key].startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key}: в production нужен https-адрес` });
      }
    }
  });

/**
 * Кому доступен режим разработчика — ровно одному аккаунту: DEVELOPER_TELEGRAM_ID, а если он не задан и
 * админ один — ему. Несколько админов без DEVELOPER_TELEGRAM_ID — никому.
 */
export function resolveDeveloperId(
  explicit: string | undefined,
  adminIds: ReadonlySet<bigint>,
): bigint | null {
  if (explicit) return BigInt(explicit);
  return adminIds.size === 1 ? [...adminIds][0]! : null;
}

function load() {
  // пустая переменная (KEY= в .env) — то же, что не заданная
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  // на Render адрес сервиса известен сам (RENDER_EXTERNAL_URL) — API_URL можно не задавать
  if (!raw.API_URL && raw.RENDER_EXTERNAL_URL) raw.API_URL = raw.RENDER_EXTERNAL_URL;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Неверные переменные окружения:\n${lines}`);
  }
  const e = parsed.data;
  const botToken = e.BOT_TOKEN ?? DEV_BOT_TOKEN;
  const adminIds = new Set(
    e.ADMIN_TELEGRAM_IDS.split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map((s) => BigInt(s)),
  );
  const corsOrigins = (e.CORS_ORIGINS ?? e.WEBAPP_URL)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return {
    ...e,
    BOT_TOKEN: botToken,
    isDev: e.NODE_ENV === 'development',
    isTest: e.NODE_ENV === 'test',
    isProd: e.NODE_ENV === 'production',
    hasRealBotToken: Boolean(e.BOT_TOKEN),
    adminIds,
    developerId: resolveDeveloperId(e.DEVELOPER_TELEGRAM_ID, adminIds),
    corsOrigins,
  };
}

export type Env = ReturnType<typeof load>;
export const env: Env = load();
