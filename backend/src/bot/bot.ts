import { Bot, InlineKeyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { env } from '../env.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { parseReferral } from '../services/referrals.js';
import { BOT_TEXTS, botLocale } from './texts.js';

/** Ссылка на Mini App; с реферальным параметром — через startapp, чтобы приглашение засчиталось. */
export function miniAppLink(startParam?: string): string {
  const base = `https://t.me/${env.BOT_USERNAME}/${env.MINIAPP_SHORT_NAME}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

/** Кнопки под приветствием: «Играть» (Mini App) и «Подписаться на канал». */
export function playKeyboard(locale: 'ru' | 'en', startParam?: string): InlineKeyboard {
  const t = BOT_TEXTS[locale];
  const kb = new InlineKeyboard();
  // Mini App, открытый кнопкой web_app, не получает start_param — для приглашения нужна прямая ссылка
  if (startParam) kb.url(t.play, miniAppLink(startParam));
  else kb.webApp(t.play, env.WEBAPP_URL);
  if (env.CHANNEL_URL) kb.row().url(t.channel, env.CHANNEL_URL);
  return kb;
}

const WELCOME_IMAGE = () => `${env.WEBAPP_URL.replace(/\/$/, '')}/assets/generated/og-image.png`;
/** file_id картинки после первой отправки — дальше Telegram не скачивает её заново */
let welcomePhotoId: string | null = null;

async function sendWelcome(ctx: Context, startParam: string | undefined): Promise<void> {
  const locale = botLocale(ctx.from?.language_code);
  const t = BOT_TEXTS[locale];
  const caption = t.welcome(ctx.from?.first_name ?? 'CEO');
  const reply_markup = playKeyboard(locale, startParam);
  try {
    const msg = await ctx.replyWithPhoto(welcomePhotoId ?? WELCOME_IMAGE(), { caption, reply_markup });
    welcomePhotoId = msg.photo.at(-1)?.file_id ?? welcomePhotoId;
  } catch (err) {
    // картинка недоступна (локальный адрес и т.п.) — приветствие текстом
    logger.warn({ err }, 'welcome photo failed');
    await ctx.reply(caption, { reply_markup });
  }
}

export function createBot(token: string = env.BOT_TOKEN, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.command('start', async (ctx) => {
    const payload = ctx.match.trim();
    const startParam = parseReferral(payload) !== null ? payload : undefined;
    // игрок написал боту — уведомления ему разрешены (если он есть в игре)
    if (ctx.from) {
      await prisma.user.updateMany({
        where: { telegramId: BigInt(ctx.from.id) },
        data: { allowsWriteToPm: true },
      });
    }
    await sendWelcome(ctx, startParam);
  });

  // на любое другое сообщение — та же кнопка «Играть»
  bot.on('message', async (ctx) => {
    const locale = botLocale(ctx.from?.language_code);
    await ctx.reply(BOT_TEXTS[locale].shortDescription, { reply_markup: playKeyboard(locale) });
  });

  bot.catch((err) => {
    logger.error({ err: err.error, update: err.ctx.update.update_id }, 'bot handler failed');
  });
  return bot;
}
