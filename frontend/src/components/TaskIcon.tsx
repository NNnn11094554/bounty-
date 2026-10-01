import type { TaskIcon as TaskIconName } from '@meowgul/shared';
import { CardIcon } from './cards/CardIcon';

/** Иконки заданий — рисунки в стиле карточек, без логотипов реальных сервисов. */
const ICONS: Record<TaskIconName, string> = {
  channel: 'megaphone/none/3',
  video: 'video/play/11',
  link: 'globe/none/5',
  friends: 'people/none/2',
  hq: 'building/none/8',
  wallet: 'wallet/none/9',
  star: 'crown/none/0',
  gift: 'gift/none/6',
  chat: 'chat/none/7',
  heart: 'heart/none/1',
};

export function TaskIcon({ icon, size }: { icon: TaskIconName; size: number }) {
  return <CardIcon icon={ICONS[icon]} size={size} />;
}
