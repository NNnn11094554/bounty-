/**
 * Задания Earn, которые сервер создаёт сам при старте. Остальные (ссылки на соцсети, видео,
 * спецпредложения) добавляются в админке — там же можно править и эти.
 * Канал для задания «Подписаться» задаётся переменными CHANNEL_ID и CHANNEL_URL:
 * без них задание создаётся выключенным.
 */
import { type TaskIcon, type TaskSection, type TaskType } from '@meowgul/shared';

export interface TaskConfig {
  id: string;
  type: TaskType;
  section: TaskSection;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: TaskIcon;
  url: string | null;
  channelId: string | null;
  requiredCount: number | null;
  reward: number;
  checkDelaySec: number;
  sortOrder: number;
}

/** Через сколько секунд после перехода по ссылке можно нажать «Проверить». */
export const DEFAULT_CHECK_DELAY_SEC = 30;

export function builtInTasks(channel: { id: string | null; url: string | null }): TaskConfig[] {
  return [
    {
      id: 'tg_channel',
      type: 'TELEGRAM_CHANNEL',
      section: 'LIST',
      titleRu: 'Подпишись на канал Meowgul',
      titleEn: 'Join the Meowgul channel',
      descRu: 'Новости офиса, комбо дня и шифры — первыми в канале.',
      descEn: 'Office news, daily combos and ciphers — first in the channel.',
      icon: 'channel',
      url: channel.url,
      channelId: channel.id,
      requiredCount: null,
      reward: 5_000,
      checkDelaySec: 0,
      sortOrder: 10,
    },
    {
      id: 'connect_wallet',
      type: 'CONNECT_WALLET',
      section: 'AIRDROP',
      titleRu: 'Подключи свой кошелёк TON',
      titleEn: 'Connect your TON wallet',
      descRu: 'Кошелёк понадобится, чтобы получить токены Airdrop.',
      descEn: 'You will need the wallet to receive the Airdrop tokens.',
      icon: 'wallet',
      url: null,
      channelId: null,
      requiredCount: null,
      reward: 0,
      checkDelaySec: 0,
      sortOrder: 10,
    },
    {
      id: 'invite_3',
      type: 'INVITE_FRIENDS',
      section: 'LIST',
      titleRu: 'Пригласи 3 друзей',
      titleEn: 'Invite 3 friends',
      descRu: 'Позови друзей в офис — вместе котам веселее.',
      descEn: 'Bring your friends to the office — cats have more fun together.',
      icon: 'friends',
      url: null,
      channelId: null,
      requiredCount: 3,
      reward: 25_000,
      checkDelaySec: 0,
      sortOrder: 50,
    },
  ];
}
