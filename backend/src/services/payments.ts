import { Api } from 'grammy';
import { env } from '../env.js';

export interface StarsInvoice {
  title: string;
  description: string;
  payload: string;
  stars: number;
  photoUrl?: string;
}

/** Платежи Telegram Stars (Bot API). В тестах подменяется (setPaymentsGateway). */
export interface PaymentsGateway {
  /** ссылка на счёт для Telegram.WebApp.openInvoice */
  createInvoiceLink(invoice: StarsInvoice): Promise<string>;
  /** вернуть звёзды покупателю */
  refund(telegramId: number, chargeId: string): Promise<void>;
}

class BotApiPayments implements PaymentsGateway {
  private readonly api = new Api(env.BOT_TOKEN, { timeoutSeconds: 10 });

  createInvoiceLink(invoice: StarsInvoice): Promise<string> {
    // Stars: валюта XTR, provider_token — пустая строка
    return this.api.createInvoiceLink(
      invoice.title,
      invoice.description,
      invoice.payload,
      '',
      'XTR',
      [{ label: invoice.title, amount: invoice.stars }],
      invoice.photoUrl ? { photo_url: invoice.photoUrl, photo_width: 1200, photo_height: 630 } : {},
    );
  }

  async refund(telegramId: number, chargeId: string): Promise<void> {
    await this.api.refundStarPayment(telegramId, chargeId);
  }
}

/** Префикс «счёта» без Telegram: в разработке и e2e оплату имитирует /api/dev/shop/pay. */
export const DEV_INVOICE_PREFIX = 'dev-invoice://';

/** Разработка без настоящего токена бота: счёт не выставляется, возврат — ничего не делает. */
class DevPayments implements PaymentsGateway {
  createInvoiceLink(invoice: StarsInvoice): Promise<string> {
    return Promise.resolve(`${DEV_INVOICE_PREFIX}${invoice.payload}`);
  }

  refund(): Promise<void> {
    return Promise.resolve();
  }
}

let gateway: PaymentsGateway | null = null;

export function payments(): PaymentsGateway {
  gateway ??= env.isProd || env.hasRealBotToken ? new BotApiPayments() : new DevPayments();
  return gateway;
}

export function setPaymentsGateway(next: PaymentsGateway | null): void {
  gateway = next;
}
