import type { Locale } from '@meowgul/shared';
import { REFERRAL, REWARDS } from '../game/config/rewards.js';

/** Имя игрока для текста с parse_mode HTML. */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const num = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(n);
/** комбо + шифр за день */
const DAILY_MAX = REWARDS.combo + REWARDS.cipher;

/** Тексты бота на двух языках. welcome — HTML (parse_mode: 'HTML'), имя экранируется. */
export const BOT_TEXTS = {
  ru: {
    description:
      'Meowgul — тапалка с чёрным котом-CEO. Тапай кота, прокачивай карточки своей крипто-компании, зови друзей и готовься к Airdrop! 🐾',
    shortDescription: 'Тапай кота, строй крипто-империю и готовься к Airdrop 🐾',
    startCommand: 'Открыть игру',
    welcome: (name: string) =>
      [
        `<b>Мяу, ${escapeHtml(name)}!</b> 🐾`,
        '',
        'Чёрный кот Meowgul назначил тебя CEO своей крипто-компании. Пока это офис с одним столом — но это ненадолго.',
        '',
        '👆 <b>Тапай кота</b> — каждый тап приносит монеты',
        '📈 <b>Покупай карточки</b> — прибыль капает каждый час, даже когда ты офлайн',
        `🧩 <b>Комбо и шифр дня</b> — до +${num(DAILY_MAX, 'ru')} монет каждый день`,
        `👥 <b>Зови друзей</b> — от +${num(REFERRAL.regular, 'ru')} монет вам обоим`,
        '🪂 <b>Airdrop</b> — подключи кошелёк и будь готов',
        '',
        'Жми «Играть» 👇',
      ].join('\n'),
    play: '▶️ Играть',
    purchaseDone: '✅ Покупка зачислена! Открой игру — всё уже на месте.',
    paySupport:
      'Проблема с покупкой? Напиши её одним сообщением вместе с командой, например:\n/paysupport не пришли монеты\n\nМы ответим в течение 24 часов и, если нужно, вернём звёзды.',
    paySupportSent: '📨 Сообщение передано поддержке. Ответим в течение 24 часов.',
    channel: '📣 Подписаться на канал',
    energyFull: '⚡ Энергия восстановлена! Кот отдохнул и готов к работе — заходи тапать.',
    friendJoined: (name: string, bonus: string) =>
      `🎉 ${name} присоединился по твоей ссылке! +${bonus} монет уже на балансе.`,
    dailyCombo: '🧩 Новое комбо дня и шифр уже ждут! Собери комбо — получи +5 000 000 монет.',
    happyHour: (multiplier: number, endsAt: number) =>
      `🍀 Счастливый час! Целый час каждый тап приносит ×${multiplier} монет${endsAt ? ` — до ${new Date(endsAt).toISOString().slice(11, 16)} UTC` : ''}. Скорее к коту!`,
  },
  en: {
    description:
      'Meowgul is a tap game with a black cat CEO. Tap the cat, upgrade your crypto company’s cards, invite friends and get ready for the Airdrop! 🐾',
    shortDescription: 'Tap the cat, build a crypto empire and get ready for the Airdrop 🐾',
    startCommand: 'Open the game',
    welcome: (name: string) =>
      [
        `<b>Meow, ${escapeHtml(name)}!</b> 🐾`,
        '',
        'The black cat Meowgul just made you CEO of the Meowgul crypto company. Right now it’s an office with a single desk — but not for long.',
        '',
        '👆 <b>Tap the cat</b> — every tap earns coins',
        '📈 <b>Buy cards</b> — profit drips in every hour, even while you’re offline',
        `🧩 <b>Daily combo & cipher</b> — up to +${num(DAILY_MAX, 'en')} coins every day`,
        `👥 <b>Invite friends</b> — from +${num(REFERRAL.regular, 'en')} coins for both of you`,
        '🪂 <b>Airdrop</b> — connect your wallet and get ready',
        '',
        'Press “Play” 👇',
      ].join('\n'),
    play: '▶️ Play',
    purchaseDone: '✅ Purchase delivered! Open the game — it’s all there.',
    paySupport:
      'Problem with a purchase? Send it in one message with the command, e.g.:\n/paysupport coins did not arrive\n\nWe reply within 24 hours and refund the Stars if needed.',
    paySupportSent: '📨 Your message was passed to support. We reply within 24 hours.',
    channel: '📣 Join the channel',
    energyFull: '⚡ Energy is full again! The cat has rested and is ready to work — come and tap.',
    friendJoined: (name: string, bonus: string) =>
      `🎉 ${name} joined with your link! +${bonus} coins are already yours.`,
    dailyCombo: '🧩 A new daily combo and cipher are waiting! Collect the combo to get +5,000,000 coins.',
    happyHour: (multiplier: number, endsAt: number) =>
      `🍀 Happy hour! For a whole hour every tap brings ×${multiplier} coins${endsAt ? ` — until ${new Date(endsAt).toISOString().slice(11, 16)} UTC` : ''}. Hurry to the cat!`,
  },
} as const;

/** Языки Telegram, для которых бот отвечает по-русски. */
export const RU_LANGS = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'hy', 'az'] as const;

export function botLocale(code: string | null | undefined): Locale {
  const base = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return (RU_LANGS as readonly string[]).includes(base) ? 'ru' : 'en';
}
