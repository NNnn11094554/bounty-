import { createHash, createHmac } from 'node:crypto';
import type { Bot } from 'grammy';
import type { LanguageCode } from 'grammy/types';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { startNotificationWorker } from '../services/notifications.js';
import { createBot } from './bot.js';
import { BOT_TEXTS, RU_LANGS } from './texts.js';

let instance: Bot | null = null;

export function getBot(): Bot {
  instance ??= createBot();
  return instance;
}

/**
 * Секрет вебхука (Telegram передаёт его в заголовке): производный от WEBHOOK_SECRET или токена.
 * Telegram принимает в secret_token только A-Z, a-z, 0-9, _ и -, а WEBHOOK_SECRET может быть любым
 * (generateValue на Render — base64 с «/», «+», «=»), поэтому отдаём hex.
 */
export function webhookSecret(): string {
  return createHmac('sha256', 'meowgul-webhook')
    .update(env.WEBHOOK_SECRET ?? env.BOT_TOKEN)
    .digest('hex')
    .slice(0, 48);
}

const CONFIG_KEY = 'botConfig';

/**
 * Команды, описание «Что умеет этот бот?» и кнопка меню, открывающая игру. Русские тексты — для всех языков
 * из RU_LANGS (у кого Telegram на украинском, тоже видит описание по-русски), английские — по умолчанию.
 * Это десятки запросов к Telegram, а бесплатный сервер перезапускается часто, поэтому настройка повторяется,
 * только когда изменились тексты или адрес игры.
 */
async function configure(bot: Bot): Promise<void> {
  // строки BOT_TEXTS (функции JSON пропускает), языки, адрес игры и сам бот
  const signature = createHash('sha256')
    .update(JSON.stringify([BOT_TEXTS, RU_LANGS, env.WEBAPP_URL, bot.botInfo.username]))
    .digest('hex');
  const saved = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
  if (saved?.value === signature) return;
  const targets: Array<[keyof typeof BOT_TEXTS, LanguageCode | undefined]> = [
    ['en', undefined],
    ...RU_LANGS.map((code) => ['ru', code] as [keyof typeof BOT_TEXTS, LanguageCode]),
  ];
  for (const [lang, language_code] of targets) {
    const t = BOT_TEXTS[lang];
    await bot.api.setMyCommands([{ command: 'start', description: t.startCommand }], { language_code });
    await bot.api.setMyDescription(t.description, { language_code });
    await bot.api.setMyShortDescription(t.shortDescription, { language_code });
  }
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: 'Play', web_app: { url: env.WEBAPP_URL } },
  });
  await prisma.appSetting.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: signature },
    update: { value: signature },
  });
  logger.info('bot profile configured');
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
      // сначала приём сообщений: без вебхука бот молчит, а описание и команды — не главное
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
      // ошибка настройки (например, лимит запросов Telegram) не останавливает бота — повтор при следующем запуске
      await configure(bot).catch((err: unknown) => logger.warn({ err }, 'bot profile setup failed'));
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
