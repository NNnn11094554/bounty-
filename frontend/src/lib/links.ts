/** Ссылка на Mini App в Telegram: t.me/<бот>/<приложение>. */
export const MINI_APP_URL = `https://t.me/${import.meta.env.VITE_BOT_USERNAME ?? 'meowgul_game_bot'}/${
  import.meta.env.VITE_MINIAPP_SHORT_NAME ?? 'app'
}`;
