import { createHmac } from 'node:crypto';
import type { Bot } from 'grammy';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';
import { startNotificationWorker } from '../services/notifications.js';
import { createBot } from './bot.js';
import { BOT_TEXTS } from './texts.js';

let instance: Bot | null = null;

export function getBot(): Bot {
  instance ??= createBot();
  return instance;
}

/** Секрет вебхука: из WEBHOOK_SECRET или производный от токена (Telegram передаёт его в заголовке). */
export function webhookSecret(): string {
  return (
    env.WEBHOOK_SECRET ??
    createHmac('sha256', 'meowgul-webhook').update(env.BOT_TOKEN).digest('hex').slice(0, 48)
  );
}

/** Команды, описание «Что умеет этот бот?» и кнопка меню, открывающая игру. */
async function configure(bot: Bot): Promise<void> {
  for (const lang of ['ru', 'en'] as const) {
    const t = BOT_TEXTS[lang];
    const language_code = lang === 'en' ? undefined : lang;
    await bot.api.setMyCommands([{ command: 'start', description: t.startCommand }], { language_code });
    await bot.api.setMyDescription(t.description, { language_code });
    await bot.api.setMyShortDescription(t.shortDescription, { language_code });
  }
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: 'Play', web_app: { url: env.WEBAPP_URL } },
  });
}

const RETRY_MS = 30_000;

/**
 * Запуск бота: в production — вебхук на API_URL/api/bot/webhook, в разработке — long polling.
 * Если Telegram недоступен, повторяем каждые 30 секунд; игра при этом работает.
 * Возвращает функцию остановки.
 */
export function startBot(): () => Promise<void> {
  const bot = getBot();
  let stopped = false;
  let polling = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const stopWorker = startNotificationWorker();

  const launch = async () => {
    if (stopped) return;
    try {
      await bot.init();
      await configure(bot);
      if (env.isProd) {
        await bot.api.setWebhook(`${env.API_URL.replace(/\/$/, '')}/api/bot/webhook`, {
          secret_token: webhookSecret(),
          allowed_updates: ['message'],
        });
        logger.info({ bot: bot.botInfo.username }, 'bot webhook set');
      } else {
        await bot.api.deleteWebhook();
        polling = true;
        void bot.start({ allowed_updates: ['message'], onStart: () => logger.info('bot polling started') });
      }
    } catch (err) {
      logger.error({ err }, 'bot start failed, retrying');
      retry = setTimeout(() => void launch(), RETRY_MS);
    }
  };
  void launch();

  return async () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    stopWorker();
    if (polling) await bot.stop();
  };
}
