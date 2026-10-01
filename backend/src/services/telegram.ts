import { Api, GrammyError, HttpError } from 'grammy';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';

export type MembershipStatus = 'member' | 'not_member';

/** Обращения к Bot API, нужные игре. В тестах подменяется (setTelegramGateway). */
export interface TelegramGateway {
  /** Подписан ли пользователь на канал. Ошибка — проверить сейчас нельзя (бот не админ, сеть). */
  channelMembership(channelId: string, telegramId: number): Promise<MembershipStatus>;
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
}

let gateway: TelegramGateway | null = null;

export function telegram(): TelegramGateway {
  gateway ??= new BotApiGateway();
  return gateway;
}

export function setTelegramGateway(next: TelegramGateway | null): void {
  gateway = next;
}
