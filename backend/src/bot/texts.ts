import type { Locale } from '@meowgul/shared';

/** Тексты бота на двух языках. */
export const BOT_TEXTS = {
  ru: {
    description:
      'Meowgul — тапалка с чёрным котом-CEO. Тапай кота, прокачивай карточки своей крипто-компании, зови друзей и готовься к Airdrop! 🐾',
    shortDescription: 'Тапай кота, строй крипто-империю и готовься к Airdrop 🐾',
    startCommand: 'Открыть игру',
    welcome: (name: string) =>
      `Привет, ${name}! 🐾\n\nТеперь ты CEO крипто-компании Meowgul. Тапай кота — зарабатывай монеты, покупай карточки — получай доход каждый час, даже когда не в игре. Зови друзей: бонус получите оба.\n\nЖми «Играть»!`,
    play: '▶️ Играть',
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
      `Hi, ${name}! 🐾\n\nYou are now the CEO of the Meowgul crypto company. Tap the cat to earn coins, buy cards to earn every hour — even when you are away. Invite friends: you both get a bonus.\n\nPress “Play”!`,
    play: '▶️ Play',
    channel: '📣 Join the channel',
    energyFull: '⚡ Energy is full again! The cat has rested and is ready to work — come and tap.',
    friendJoined: (name: string, bonus: string) =>
      `🎉 ${name} joined with your link! +${bonus} coins are already yours.`,
    dailyCombo: '🧩 A new daily combo and cipher are waiting! Collect the combo to get +5,000,000 coins.',
    happyHour: (multiplier: number, endsAt: number) =>
      `🍀 Happy hour! For a whole hour every tap brings ×${multiplier} coins${endsAt ? ` — until ${new Date(endsAt).toISOString().slice(11, 16)} UTC` : ''}. Hurry to the cat!`,
  },
} as const;

export function botLocale(code: string | null | undefined): Locale {
  const base = (code ?? '').toLowerCase().split('-')[0] ?? '';
  return ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'hy', 'az'].includes(base) ? 'ru' : 'en';
}
