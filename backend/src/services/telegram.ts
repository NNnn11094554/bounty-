import { Api, GrammyError, HttpError } from 'grammy';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';

export type MembershipStatus = 'member' | 'not_member';

export interface MessageButton {
  text: string;
  /** обычная ссылка или Mini App (web_app) */
  url?: string;
  webApp?: string;
}

/** Обращения к Bot API, нужные игре. В тестах подменяется (setTelegramGateway). */
export interface TelegramGateway {
  /** Подписан ли пользователь на канал. Ошибка — проверить сейчас нельзя (бот не админ, сеть). */
  channelMembership(channelId: string, telegramId: number): Promise<MembershipStatus>;
  /** Отправить сообщение (с картинкой — фото с подписью); ошибки — TelegramSendError. */
  sendMessage(
    chatId: number,
    text: string,
    button?: MessageButton,
    opts?: { imageUrl?: string },
  ): Promise<void>;
}

/** Ошибка отправки: blocked — пользователь заблокировал бота, retryAfter — превышен лимит Telegram. */
export class TelegramSendError extends Error {
  constructor(
    message: string,
    readonly kind: 'blocked' | 'rate_limited' | 'failed',
    readonly retryAfterSec = 0,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_SEC = 5;

export class TelegramUnavailableError extends Error {}

class BotApiGateway implements TelegramGateway {
  private readonly api = new Api(env.BOT_TOKEN, { timeoutSeconds: REQUEST_TIMEOUT_SEC });

  async channelMembership(channelId: string, telegramId: number): Promise<MembershipStatus> {
    try {
      const member = await this.api.getChatMember(channelId, telegramId);
      if (member.status === 'creator' || member.status === 'administrator' || member.status === 'member') {
        return 'member';
      }
      if (member.status === 'restricted') return member.is_member ? 'member' : 'not_member';
      return 'not_member';
    } catch (err) {
      // пользователь ни разу не заходил в канал — Telegram отвечает 400 «user not found»
      if (
        err instanceof GrammyError &&
        err.error_code === 400 &&
        /user not found|participant/i.test(err.description)
      ) {
        return 'not_member';
      }
      const reason =
        err instanceof GrammyError ? err.description : err instanceof HttpError ? 'network' : String(err);
      logger.warn({ channelId, reason }, 'getChatMember failed');
      throw new TelegramUnavailableError(reason);
    }
  }

  async sendMessage(
    chatId: number,
    text: string,
    button?: MessageButton,
    opts: { imageUrl?: string } = {},
  ): Promise<void> {
    const reply_markup = button
      ? {
          inline_keyboard: [
            [
              button.webApp
                ? { text: button.text, web_app: { url: button.webApp } }
                : { text: button.text, url: button.url ?? '' },
            ],
          ],
        }
      : undefined;
    try {
      if (opts.imageUrl) await this.api.sendPhoto(chatId, opts.imageUrl, { caption: text, reply_markup });
      else
        await this.api.sendMessage(chatId, text, {
          reply_markup,
          link_preview_options: { is_disabled: true },
        });
    } catch (err) {
      if (err instanceof GrammyError) {
        if (err.error_code === 403) throw new TelegramSendError(err.description, 'blocked');
        if (err.error_code === 429) {
          throw new TelegramSendError(err.description, 'rate_limited', err.parameters.retry_after ?? 5);
        }
        throw new TelegramSendError(err.description, 'failed');
      }
      throw new TelegramSendError(err instanceof HttpError ? 'network' : String(err), 'rate_limited', 5);
    }
  }
}

let gateway: TelegramGateway | null = null;

export function telegram(): TelegramGateway {
  gateway ??= new BotApiGateway();
  return gateway;
}

export function setTelegramGateway(next: TelegramGateway | null): void {
  gateway = next;
}
