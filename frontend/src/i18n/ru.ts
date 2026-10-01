/** Русский словарь — источник ключей. Английский обязан содержать те же ключи. */
export const ru = {
  'app.name': 'Meowgul',
  'common.retry': 'Повторить',
  'common.reload': 'Перезагрузить',
  'common.close': 'Закрыть',
  'common.ok': 'Понятно',
  'common.thanks': 'Спасибо',
  'common.loading': 'Загрузка…',
  'boot.loading': 'Кот просыпается…',
  'boot.connecting': 'Подключаемся к офису…',
  'error.network.title': 'Нет соединения',
  'error.network.text': 'Пытаемся снова… Проверьте интернет.',
  'error.generic.title': 'Что-то пошло не так',
  'error.generic.text': 'Кот уже чинит провода. Попробуйте перезагрузить игру.',
  'error.notTelegram.title': 'Откройте игру в Telegram',
  'error.notTelegram.text': 'Meowgul работает как Mini App внутри Telegram.',
  'error.notTelegram.button': 'Открыть в Telegram',
  'error.banned.title': 'Аккаунт заблокирован',
  'error.banned.text': 'Мы заметили нечестную игру. Если это ошибка — напишите в поддержку.',
  'error.maintenance.title': 'Технические работы',
  'error.maintenance.text': 'Кот наводит порядок в офисе. Возвращайтесь чуть позже.',
  'error.outdated.title': 'Доступна новая версия',
  'error.outdated.text': 'Перезапустите игру, чтобы получить обновление.',
  'error.unauthorized.title': 'Сессия устарела',
  'error.unauthorized.text': 'Закройте и снова откройте игру из бота.',
} as const;

export type MessageKey = keyof typeof ru;
